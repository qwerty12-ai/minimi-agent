import { describe, expect, it, vi } from "vitest";

import {
  OllamaClient,
  OllamaResponseError,
} from "../src/llm/ollama-client.js";

describe("OllamaClient", () => {

  it("sends a request and parses structured JSON", async () => {

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({
              intent: "RECALL",
            }),
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    );

    const client = new OllamaClient(
      {
        baseUrl: "http://localhost:11434",
        model: "qwen3.5:2b",
      },
      mockFetch as typeof fetch
    );

    const result = await client.generateStructured({
      messages: [
        {
          role: "user",
          content: "What did I ask previously?",
        },
      ],
      format: {
        type: "object",
      },
    });

    expect(result).toEqual({
      intent: "RECALL",
    });

    expect(mockFetch).toHaveBeenCalledOnce();

  });

  it("rejects an unsuccessful HTTP response", async () => {

    const mockFetch = vi.fn().mockResolvedValue(
      new Response("Server error", {
        status: 500,
      })
    );

    const client = new OllamaClient(
      {
        baseUrl: "http://localhost:11434",
        model: "qwen3.5:2b",
      },
      mockFetch as typeof fetch
    );

    await expect(
      client.generateStructured({
        messages: [
          {
            role: "user",
            content: "Test",
          },
        ],
        format: {
          type: "object",
        },
      })
    ).rejects.toThrow(OllamaResponseError);

  });

  it("rejects malformed JSON returned by the model", async () => {

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: {
            content: "This is not JSON",
          },
        }),
        {
          status: 200,
        }
      )
    );

    const client = new OllamaClient(
      {
        baseUrl: "http://localhost:11434",
        model: "qwen3.5:2b",
      },
      mockFetch as typeof fetch
    );

    await expect(
      client.generateStructured({
        messages: [
          {
            role: "user",
            content: "Test",
          },
        ],
        format: {
          type: "object",
        },
      })
    ).rejects.toThrow(OllamaResponseError);

  });

});