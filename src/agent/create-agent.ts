import { planRequest } from "./plan-request.js";
import { createOllamaIntentClassifier } from "../llm/create-ollama-provider.js";

export function createAgent() {
    const classifier = createOllamaIntentClassifier();

    return {
        async plan(message: string) {
            return planRequest(message, classifier);
        }
    }
}