import type {
  LLMProvider,
  StructuredGenerationRequest,
} from "./llm-provider.js";

import { z } from "zod";

interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
}

export class OllamaConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OllamaConnectionError";
  }
}

export class OllamaTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OllamaTimeoutError";
  }
}

export class OllamaResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OllamaResponseError";
  }
}

const ollamaResponseSchema = z.object({
  message: z.object({
    content: z.string(),
  }).passthrough(),
}).passthrough();

export class OllamaClient implements LLMProvider {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(
    config: OllamaConfig,
    fetchImpl: typeof fetch = fetch
  ) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.model = config.model;
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.fetchImpl = fetchImpl;
  }

  async generateStructured(
    request: StructuredGenerationRequest
  ): Promise<unknown> {

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchImpl(
        `${this.baseUrl}/api/chat`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            model: this.model,
            messages: request.messages,
            stream: false,
            format: request.format,
            think: request.think ?? false,

            options: {
              temperature: request.temperature ?? 0,
            },
          }),

          signal: controller.signal,
        }
      );

      if (!response.ok) {
        throw new OllamaResponseError(
          `Ollama returned HTTP ${response.status}.`
        );
      }

      const rawResponse: unknown = await response.json();

      const parsedResponse =
        ollamaResponseSchema.safeParse(rawResponse);

      if (!parsedResponse.success) {
        throw new OllamaResponseError(
          "Ollama returned an invalid response structure."
        );
      }

      try {
        return JSON.parse(
          parsedResponse.data.message.content
        ) as unknown;
      } catch {
        throw new OllamaResponseError(
          "Ollama returned invalid JSON content."
        );
      }

    } catch (error) {

      if (error instanceof OllamaResponseError) {
        throw error;
      }

      if (controller.signal.aborted) {
        throw new OllamaTimeoutError(
          `Ollama request timed out after ${this.timeoutMs}ms.`
        );
      }

      throw new OllamaConnectionError(
        error instanceof Error
          ? error.message
          : "Unable to connect to Ollama."
      );

    } finally {
      clearTimeout(timeout);
    }
  }
}