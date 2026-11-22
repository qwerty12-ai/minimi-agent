import type { SQLiteDatabase } from "../database/sqlite.js";

import type {
    MemorySearchRepository,
    MemorySearchResult,
} from "./types.js";

interface MemorySearchRow {
    source_type: "conversation_message" | "memory_record";
    source_id: string;
    content: string;
    created_at: string;
    rank: number;
    kind: string | null;
}

function buildSearchExpression(
    query: string,
    operator: "AND" | "OR" = "AND",
): string {
    const terms = query
        .normalize("NFKC")
        .match(/[\p{L}\p{N}_]+/gu);

    if (!terms || terms.length === 0) {
        return "";
    }

    return terms
        .map((term) => `"${term.replace(/"/g, '""')}"`)
        .join(` ${operator} `);
}

export class SQLiteMemorySearchRepository
    implements MemorySearchRepository {
    constructor(
        private readonly database: SQLiteDatabase
    ) {}

    async search(
        query: string,
        limit = 10
    ): Promise<MemorySearchResult[]> {
        if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
            throw new Error("Search limit must be between 1 and 50.");
        }

        const expression = buildSearchExpression(query);

        if (expression.length === 0) {
            return [];
        }

        const search = this.database.prepare(`
            SELECT
                documents.source_type,
                documents.source_id,
                documents.content,
                documents.created_at,
                documents.kind,
                bm25(memory_search_index) AS rank
            FROM memory_search_index
            JOIN memory_search_documents AS documents
                ON documents.id = memory_search_index.rowid
            WHERE memory_search_index MATCH ?
            ORDER BY rank ASC
            LIMIT ?
        `);

        let rows = search.all(expression, limit) as MemorySearchRow[];

        // Preserve precise matching first. Fall back to OR matching when
        // natural-language questions contain words absent from stored text.
        if (rows.length === 0) {
            const fallbackExpression = buildSearchExpression(query, "OR");

            if (
                fallbackExpression.length > 0 &&
                fallbackExpression !== expression
            ) {
                rows = search.all(
                    fallbackExpression,
                    limit
                ) as MemorySearchRow[];
            }
        }

        return rows.map((row) => ({
            sourceType: row.source_type,
            sourceId: row.source_id,
            content: row.content,
            createdAt: row.created_at,
            rank: row.rank,
            ...(row.kind !== null
                ? {
                    kind: row.kind as NonNullable<
                        MemorySearchResult["kind"]
                    >,
                }
                : {}),
        }));
    }
}