import { describe, expect, it, vi } from "vitest";

import { planRequest } from "../src/agent/plan-request.js";

import type { IntentClassifier } from "../src/agent/types.js";

describe("planRequest", () => {

  it("creates an execution plan using the classified intent", async () => {

    const classifier: IntentClassifier = {
      classify: vi.fn().mockResolvedValue({
        intent: "RECALL",
      }),
    };

    const plan = await planRequest(
      "  What did I ask about PostgreSQL?  ",
      classifier
    );

    expect(classifier.classify).toHaveBeenCalledWith({
      message: "What did I ask about PostgreSQL?",
    });

    expect(plan).toEqual({
      intent: "RECALL",
      requiresMemory: true,
      requiresSearch: false,
    });

  });

  it("rejects empty messages", async () => {

    const classifier: IntentClassifier = {
      classify: vi.fn(),
    };

    await expect(
      planRequest("   ", classifier)
    ).rejects.toThrow("Message must not be empty.");

    expect(classifier.classify).not.toHaveBeenCalled();

  });

  it("rejects invalid classifier output", async () => {

    const classifier: IntentClassifier = {
      classify: vi.fn().mockResolvedValue({
        intent: "UNKNOWN",
      }),
    };

    await expect(
      planRequest("Find current pricing.", classifier)
    ).rejects.toThrow();

  });

});