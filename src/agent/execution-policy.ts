import type {
    ExecutionPlan,
    ExecutionRequirements,
    Intent
} from "./types.js";

export const EXECUTION_POLICY = {
    RECALL: {
        requiresMemory: true,
        requiresSearch: false
    },
    RESEARCH: {
        requiresMemory: false,
        requiresSearch: true
    },
    VERIFY: {
        requiresMemory: true,
        requiresSearch: true
    },
    COMPARE: {
        requiresMemory: true,
        requiresSearch: true
    }
} as const satisfies Record<Intent, ExecutionRequirements>

export function createExecutionPlan(intent: Intent): ExecutionPlan {
    return {
        intent,
        ...EXECUTION_POLICY[intent]
    };
}