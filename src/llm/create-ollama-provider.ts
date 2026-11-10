import { OllamaClient } from "./ollama-client.js";
import { OllamaIntentClassifier } from "./ollama-intent-classifier.js";
import { getOllamaConfig } from "../config/ollama.js";

export function createOllamaIntentClassifier(): OllamaIntentClassifier {
    const config = getOllamaConfig();

    const client = new OllamaClient({
        baseUrl: config.baseUrl,
        model: config.model,
        timeoutMs: config.timeoutMs
    })

    return new OllamaIntentClassifier(client);
}