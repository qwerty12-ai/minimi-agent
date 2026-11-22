import { describe, expect, it, vi } from "vitest";

import { OllamaIntentClassifier } from "../src/llm/ollama-intent-classifier.js";

import type { LLMProvider } from "../src/llm/llm-provider.js";

describe("OllamaIntentClassifier", () => {
  it.each([
    {
      message: "What project codename did I tell you earlier?",
      intent: "RECALL",
    },
    {
      message: "Research the current stable release of Node.js.",
      intent: "RESEARCH",
    },
    {
      message: "Compare the official TypeScript support of Node.js and Deno. Use multiple sources.",
      intent: "RESEARCH",
    },
    {
      message: "Which database is faster, PostgreSQL or MySQL?",
      intent: "RESEARCH",
    },
    {
      message: "Check whether the release information you found earlier is still correct.",
      intent: "VERIFY",
    },
    {
      message: "Compare the product price I previously mentioned with its current price.",
      intent: "COMPARE",
    },
  ] as const)(
    "returns the expected intent for: $message",
    async ({ message, intent }) => {
      const llm: LLMProvider = {
        generateStructured: vi.fn().mockResolvedValue({
          intent,
        }),
      };

      const classifier = new OllamaIntentClassifier(llm);

      const result = await classifier.classify({
        message,
      });

      expect(result).toEqual({ intent });
      expect(llm.generateStructured).toHaveBeenCalledOnce();
    },
  );

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
      }),
    ).rejects.toThrow();
  });

  it("uses deterministic structured generation", async () => {
    const generateStructured = vi.fn().mockResolvedValue({
      intent: "RESEARCH",
    });

    const llm: LLMProvider = {
      generateStructured,
    };

    const classifier = new OllamaIntentClassifier(llm);

    await classifier.classify({
      message: "Compare Node.js and Deno.",
    });

    const generationRequest = generateStructured.mock.calls[0][0];

    expect(generationRequest.temperature).toBe(0);
    expect(generationRequest.think).toBe(false);
    expect(generationRequest.format).toEqual(
      expect.objectContaining({
        type: "object",
        additionalProperties: false,
      }),
    );

    expect(
      generationRequest.messages[0].content,
    ).toContain(
      "is RESEARCH, not COMPARE.",
    );
  });
});