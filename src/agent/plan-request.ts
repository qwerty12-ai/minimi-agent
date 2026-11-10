import type { IntentClassifier, ExecutionPlan } from "./types.js";
import { parseIntentClassification } from "./intent-schema.js";
import { createExecutionPlan } from "./execution-policy.js";

export async function planRequest(message: string, classifier: IntentClassifier): Promise<ExecutionPlan> {
    const normalizedMessage = message.trim();

    if (normalizedMessage.length === 0) {
        throw new Error("Message must not be empty.");
    }

    const classification = await classifier.classify({
        message: normalizedMessage
    })

    const validated = parseIntentClassification(classification)

    return createExecutionPlan(validated.intent)
}