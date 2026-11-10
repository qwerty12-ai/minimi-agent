import { describe, expect, it } from "vitest";

import { planRequest } from "../src/agent/plan-request.js";

import type {
  IntentClassifier,
} from "../src/agent/types.js";

describe("Agent boundary and error handling", () => {

  it("rejects an empty message", async () => {
    const classifier: IntentClassifier = {
      classify: async () => ({
        intent: "RESEARCH",
      }),
    };

    await expect(
      planRequest("", classifier)
    ).rejects.toThrow("Message must not be empty.");
  });

  it("rejects whitespace-only messages", async () => {
    const classifier: IntentClassifier = {
      classify: async () => ({
        intent: "RESEARCH",
      }),
    };

    await expect(
      planRequest("     ", classifier)
    ).rejects.toThrow("Message must not be empty.");
  });

  it("propagates classifier errors", async () => {
    const classifierError = new Error(
      "Classifier service unavailable."
    );

    const classifier: IntentClassifier = {
      classify: async () => {
        throw classifierError;
      },
    };

    await expect(
      planRequest("Find latest pricing.", classifier)
    ).rejects.toBe(classifierError);
  });

  it("rejects invalid classifier output", async () => {
    const classifier = {
      classify: async () => ({
        intent: "UNKNOWN",
      }),
    } as unknown as IntentClassifier;

    await expect(
      planRequest("Find latest pricing.", classifier)
    ).rejects.toThrow();
  });

  it("rejects unexpected classifier properties", async () => {
    const classifier = {
      classify: async () => ({
        intent: "RESEARCH",
        extra: true,
      }),
    } as unknown as IntentClassifier;

    await expect(
      planRequest("Find latest pricing.", classifier)
    ).rejects.toThrow();
  });

});