import { describe, expect, it } from "vitest";

import {
  createExecutionPlan,
  EXECUTION_POLICY,
} from "../src/agent/execution-policy.js";

import { INTENTS } from "../src/agent/types.js";

describe("execution policy", () => {

  it("defines a policy for every supported intent", () => {
    expect(Object.keys(EXECUTION_POLICY).sort())
      .toEqual([...INTENTS].sort());
  });

  it.each([
    ["RECALL", true, false],
    ["RESEARCH", false, true],
    ["VERIFY", true, true],
    ["COMPARE", true, true],
  ] as const)(
    "creates the expected plan for %s",
    (intent, requiresMemory, requiresSearch) => {

      expect(createExecutionPlan(intent)).toEqual({
        intent,
        requiresMemory,
        requiresSearch,
      });

    }
  );

});