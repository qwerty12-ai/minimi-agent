import type { MemorySearchRepository } from "../memory/types.js";
import type { MemoryContext } from "./orchestration-types.js";

import { parseMemoryContext } from "./orchestration-schema.js";

export class MemoryRetrievalError extends Error {
    readonly stage = "memory" as const;
    readonly code = "MEMORY_RETRIEVAL_FAILED" as const;
    readonly retryable = true;

    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "MemoryRetrievalError";
    }
}

export class MemoryRetriever {
    constructor(
        private readonly repository: MemorySearchRepository,
        private readonly clock: () => Date = () => new Date(),
    ) { }

    async retrieve(
        query: string,
        limit = 10,
    ): Promise<MemoryContext> {
        const normalizedQuery = query.trim();

        if (
            normalizedQuery.length === 0 ||
            normalizedQuery.length > 500
        ) {
            throw new Error(
                "Memory search query must contain between 1 and 500 characters.",
            );
        }

        if (
            !Number.isInteger(limit) ||
            limit < 1 ||
            limit > 50
        ) {
            throw new Error(
                "Memory search limit must be between 1 and 50.",
            );
        }

        let results;

        try {
            results = await this.repository.search(
                normalizedQuery,
                limit,
            );
        } catch (error) {
            throw new MemoryRetrievalError(
                error instanceof Error
                    ? error.message
                    : "Memory retrieval failed.",
                { cause: error },
            );
        }

        try {
            const context: MemoryContext = {
                query: normalizedQuery,
                retrievedAt: this.clock().toISOString(),
                results,
            };

            parseMemoryContext(context);

            return context;
        } catch (error) {
            throw new MemoryRetrievalError(
                "Memory repository returned invalid retrieval data.",
                { cause: error },
            );
        }
    }
}