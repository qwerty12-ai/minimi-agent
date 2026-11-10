interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

export function getOllamaConfig(): OllamaConfig {
  const baseUrl =
    process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

  const model =
    process.env.OLLAMA_MODEL ?? "qwen3.5:2b";

  const timeoutMs = Number(
    process.env.OLLAMA_TIMEOUT_MS ?? 30000
  );

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Invalid Ollama timeout configuration.");
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    model,
    timeoutMs,
  };
}