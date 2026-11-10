export const INTENTS = [
    "RECALL",
    "RESEARCH",
    "VERIFY",
    "COMPARE"
] as const;

export type Intent = (typeof INTENTS)[number];

export interface IntentClassification {
    intent: Intent;
}

export interface ExecutionRequirements {
    requiresMemory: boolean;
    requiresSearch: boolean;
}

export interface ExecutionPlan extends ExecutionRequirements {
    intent: Intent;
}

export interface ClassifionInput {
    message: string;
}

export interface IntentClassifier {
    classify(input: ClassifionInput): Promise<IntentClassification>
}