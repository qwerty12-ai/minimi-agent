import { describe, expect, it } from "vitest";

import { planRequest } from "../src/agent/plan-request.js";

import type {
  Intent,
  IntentClassifier,
} from "../src/agent/types.js";

const routingCases = [
  {
    intent: "RECALL",
    requiresMemory: true,
    requiresSearch: false,
  },
  {
    intent: "RESEARCH",
    requiresMemory: false,
    requiresSearch: true,
  },
  {
    intent: "VERIFY",
    requiresMemory: true,
    requiresSearch: true,
  },
  {
    intent: "COMPARE",
    requiresMemory: true,
    requiresSearch: true,
  },
] as const satisfies Array<{
  intent: Intent;
  requiresMemory: boolean;
  requiresSearch: boolean;
}>;

describe("Intent routing integration", () => {
  it.each(routingCases)(
    "routes $intent correctly",
    async ({ intent, requiresMemory, requiresSearch }) => {
      const classifier: IntentClassifier = {
        classify: async () => ({
          intent,
        }),
      };

      const plan = await planRequest(
        `Test message for ${intent}`,
        classifier
      );

      expect(plan).toEqual({
        intent,
        requiresMemory,
        requiresSearch,
      });
    }
  );
});