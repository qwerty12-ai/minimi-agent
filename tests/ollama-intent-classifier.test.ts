import { describe, expect, it, vi } from "vitest";

import { OllamaIntentClassifier } from "../src/llm/ollama-intent-classifier.js";

import type { LLMProvider } from "../src/llm/llm-provider.js";

describe("OllamaIntentClassifier", () => {

  it("classifies a historical question as RECALL", async () => {

    const llm: LLMProvider = {
      generateStructured: vi.fn().mockResolvedValue({
        intent: "RECALL",
      }),
    };

    const classifier = new OllamaIntentClassifier(llm);

    const result = await classifier.classify({
      message: "What did I ask about PostgreSQL?",
    });

    expect(result).toEqual({
      intent: "RECALL",
    });

    expect(llm.generateStructured).toHaveBeenCalledOnce();

  });

  it("rejects invalid model output", async () => {

    const llm: LLMProvider = {
      generateStructured: vi.fn().mockResolvedValue({
        intent: "UNKNOWN",
      }),
    };

    const classifier = new OllamaIntentClassifier(llm);

    await expect(
      classifier.classify({
        message: "Find current pricing.",
      })
    ).rejects.toThrow();

  });

});