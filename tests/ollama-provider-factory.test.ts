import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createOllamaClient,
  createOllamaIntentClassifier,
} from "../src/llm/create-ollama-provider.js";

describe("Ollama provider factory", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates an Ollama client using the configured environment", () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434/");
    vi.stubEnv("OLLAMA_MODEL", "qwen3.5:2b");
    vi.stubEnv("OLLAMA_TIMEOUT_MS", "45000");

    const client = createOllamaClient();

    expect(client).toBeDefined();
    expect(client.constructor.name).toBe("OllamaClient");
  });

  it("creates an intent classifier using the Ollama client factory", () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
    vi.stubEnv("OLLAMA_MODEL", "qwen3.5:2b");
    vi.stubEnv("OLLAMA_TIMEOUT_MS", "30000");

    const classifier = createOllamaIntentClassifier();

    expect(classifier).toBeDefined();
    expect(classifier.constructor.name).toBe("OllamaIntentClassifier");
  });

  it("rejects an invalid Ollama timeout configuration", () => {
    vi.stubEnv("OLLAMA_TIMEOUT_MS", "invalid");

    expect(() => createOllamaClient()).toThrow(
      "Invalid Ollama timeout configuration."
    );
  });
});
