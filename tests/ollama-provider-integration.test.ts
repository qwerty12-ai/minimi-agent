import { describe, expect, it } from "vitest";

import { OllamaClient } from "../src/llm/ollama-client.js";

import { OllamaIntentClassifier } from "../src/llm/ollama-intent-classifier.js";

describe("Ollama provider integration", () => {

  it("connects the classifier to Ollama correctly", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    const mockFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;

      return new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({
              intent: "RESEARCH",
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
        baseUrl: "http://localhost:11434/",
        model: "qwen3.5:2b",
      },
      mockFetch
    );

    const classifier = new OllamaIntentClassifier(client);

    const result = await classifier.classify({
      message: "Find the latest pricing of Neon.",
    });

    expect(result).toEqual({
      intent: "RESEARCH",
    });

    expect(capturedUrl).toBe(
      "http://localhost:11434/api/chat"
    );

    expect(capturedInit?.method).toBe("POST");

    const payload = JSON.parse(
      String(capturedInit?.body)
    );

    expect(payload.model).toBe("qwen3.5:2b");

    expect(payload.stream).toBe(false);

    expect(payload.think).toBe(false);

    expect(payload.options.temperature).toBe(0);

    expect(payload.messages).toEqual([
      {
        role: "system",
        content: expect.any(String),
      },
      {
        role: "user",
        content: "Find the latest pricing of Neon.",
      },
    ]);

    expect(payload.format).toEqual({
      type: "object",
      properties: {
        intent: {
          type: "string",
          enum: [
            "RECALL",
            "RESEARCH",
            "VERIFY",
            "COMPARE",
          ],
        },
      },
      required: ["intent"],
      additionalProperties: false,
    });
  });

});