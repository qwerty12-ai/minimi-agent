import { describe, expect, it } from "vitest";

import { planRequest } from "../src/agent/plan-request.js";

import { OllamaClient } from "../src/llm/ollama-client.js";

import { OllamaIntentClassifier } from "../src/llm/ollama-intent-classifier.js";

const testCases = [
  {
    intent: "RECALL",
    message: "What did we discuss previously?",
    requiresMemory: true,
    requiresSearch: false,
  },
  {
    intent: "RESEARCH",
    message: "Find the latest pricing of Neon.",
    requiresMemory: false,
    requiresSearch: true,
  },
  {
    intent: "VERIFY",
    message: "Is the previous pricing still accurate?",
    requiresMemory: true,
    requiresSearch: true,
  },
  {
    intent: "COMPARE",
    message: "Compare our previous shortlist with current features.",
    requiresMemory: true,
    requiresSearch: true,
  },
] as const;

describe("Full architecture regression", () => {

  it.each(testCases)(
    "processes $intent through the complete pipeline",
    async ({
      intent,
      message,
      requiresMemory,
      requiresSearch,
    }) => {

      const mockFetch: typeof fetch = async () => {
        return new Response(
          JSON.stringify({
            message: {
              content: JSON.stringify({
                intent,
              }),
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      };

      const client = new OllamaClient(
        {
          baseUrl: "http://localhost:11434",
          model: "qwen3.5:2b",
        },
        mockFetch
      );

      const classifier = new OllamaIntentClassifier(client);

      const plan = await planRequest(
        message,
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