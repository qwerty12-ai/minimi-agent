import { describe, expect, it } from "vitest";

import {
  parseIntentClassification,
} from "../src/agent/intent-schema.js";

describe("intent classification schema", () => {

  it("accepts a supported intent", () => {

    expect(
      parseIntentClassification({
        intent: "RECALL",
      })
    ).toEqual({
      intent: "RECALL",
    });

  });

  it("rejects unsupported intent values", () => {

    expect(() =>
      parseIntentClassification({
        intent: "CHAT",
      })
    ).toThrow();

  });

  it("rejects unexpected fields", () => {

    expect(() =>
      parseIntentClassification({
        intent: "RECALL",
        requires_memory: false,
        requires_search: true,
      })
    ).toThrow();

  });

});