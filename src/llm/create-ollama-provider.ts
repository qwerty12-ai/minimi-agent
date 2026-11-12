import { OllamaClient } from "./ollama-client.js";
import { OllamaIntentClassifier } from "./ollama-intent-classifier.js";
import { getOllamaConfig } from "../config/ollama.js";

export function createOllamaClient(): OllamaClient {
    const config = getOllamaConfig();

    return new OllamaClient({
        baseUrl: config.baseUrl,
        model: config.model,
        timeoutMs: config.timeoutMs,
    });
}

export function createOllamaIntentClassifier(): OllamaIntentClassifier {
    const client = createOllamaClient();

    return new OllamaIntentClassifier(client);
}
