import type { SQLiteDatabase } from "../database/sqlite.js";

import type {
    Conversation,
    ConversationMessage,
    ConversationRepository,
    ResearchSnapshot,
    ResearchSnapshotRepository,
} from "./types.js";

import {
    parseConversation,
    parseConversationMessage,
    parseResearchSnapshot,
} from "./memory-schema.js";

import { parseSearchResult } from "../research/search-schema.js";

interface ConversationRow {
    id: string;
    title: string | null;
    created_at: string;
    updated_at: string;
}

interface MessageRow {
    id: string;
    conversation_id: string;
    role: ConversationMessage["role"];
    content: string;
    created_at: string;
}

interface SnapshotRow {
    id: string;
    conversation_id: string | null;
    query: string;
    provider: string;
    searched_at: string;
    recorded_at: string;
}

interface SnapshotResultRow {
    title: string;
    url: string;
    snippet: string;
    source: string;
    published_at: string | null;
    score: number | null;
}

export class SQLiteConversationRepository
    implements ConversationRepository {
    constructor(
        private readonly database: SQLiteDatabase
    ) { }

    async create(conversation: Conversation): Promise<void> {
        const validated = parseConversation(conversation);

        this.database
            .prepare(`
        INSERT INTO conversations (
          id,
          title,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?)
      `)
            .run(
                validated.id,
                validated.title ?? null,
                validated.createdAt,
                validated.updatedAt
            );
    }

    async findById(id: string): Promise<Conversation | null> {
        const row = this.database
            .prepare(`
        SELECT
          id,
          title,
          created_at,
          updated_at
        FROM conversations
        WHERE id = ?
      `)
            .get(id) as ConversationRow | undefined;

        if (!row) {
            return null;
        }

        const parsed = parseConversation({
            id: row.id,
            ...(row.title !== null ? { title: row.title } : {}),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });

        return {
            id: parsed.id,
            ...(parsed.title !== undefined
                ? { title: parsed.title }
                : {}),
            createdAt: parsed.createdAt,
            updatedAt: parsed.updatedAt,
        };
    }

    async appendMessage(
        message: ConversationMessage
    ): Promise<void> {
        const validated = parseConversationMessage(message);

        const insertMessage = this.database.prepare(`
      INSERT INTO conversation_messages (
        id,
        conversation_id,
        role,
        content,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `);

        const updateConversation = this.database.prepare(`
      UPDATE conversations
      SET updated_at = ?
      WHERE id = ?
    `);

        const save = this.database.transaction(() => {
            insertMessage.run(
                validated.id,
                validated.conversationId,
                validated.role,
                validated.content,
                validated.createdAt
            );

            updateConversation.run(
                validated.createdAt,
                validated.conversationId
            );
        });

        save();
    }

    async getMessages(
        conversationId: string
    ): Promise<ConversationMessage[]> {
        const rows = this.database
            .prepare(`
        SELECT
          id,
          conversation_id,
          role,
          content,
          created_at
        FROM conversation_messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC, rowid ASC
      `)
            .all(conversationId) as MessageRow[];

        return rows.map((row) =>
            parseConversationMessage({
                id: row.id,
                conversationId: row.conversation_id,
                role: row.role,
                content: row.content,
                createdAt: row.created_at,
            })
        );
    }
}

export class SQLiteResearchSnapshotRepository
    implements ResearchSnapshotRepository {
    constructor(
        private readonly database: SQLiteDatabase
    ) { }

    async save(snapshot: ResearchSnapshot): Promise<void> {
        const validated = parseResearchSnapshot(snapshot);

        const insertSnapshot = this.database.prepare(`
      INSERT INTO research_snapshots (
        id,
        conversation_id,
        query,
        provider,
        searched_at,
        recorded_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);

        const insertResult = this.database.prepare(`
      INSERT INTO research_snapshot_results (
        snapshot_id,
        result_order,
        title,
        url,
        snippet,
        source,
        published_at,
        score
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const save = this.database.transaction(() => {
            insertSnapshot.run(
                validated.id,
                validated.conversationId ?? null,
                validated.query,
                validated.provider,
                validated.searchedAt,
                validated.recordedAt
            );

            validated.results.forEach((result, index) => {
                insertResult.run(
                    validated.id,
                    index,
                    result.title,
                    result.url,
                    result.snippet,
                    result.source,
                    result.publishedAt ?? null,
                    result.score ?? null
                );
            });
        });

        save();
    }

    async findById(
        id: string
    ): Promise<ResearchSnapshot | null> {
        const row = this.database
            .prepare(`
        SELECT
          id,
          conversation_id,
          query,
          provider,
          searched_at,
          recorded_at
        FROM research_snapshots
        WHERE id = ?
      `)
            .get(id) as SnapshotRow | undefined;

        if (!row) {
            return null;
        }

        return this.buildSnapshot(row);
    }

    async findByConversation(
        conversationId: string
    ): Promise<ResearchSnapshot[]> {
        const rows = this.database
            .prepare(`
        SELECT
          id,
          conversation_id,
          query,
          provider,
          searched_at,
          recorded_at
        FROM research_snapshots
        WHERE conversation_id = ?
        ORDER BY recorded_at ASC, id ASC
      `)
            .all(conversationId) as SnapshotRow[];

        return rows.map((row) => this.buildSnapshot(row));
    }

    private buildSnapshot(row: SnapshotRow): ResearchSnapshot {
        const resultRows = this.database
            .prepare(`
        SELECT
          title,
          url,
          snippet,
          source,
          published_at,
          score
        FROM research_snapshot_results
        WHERE snapshot_id = ?
        ORDER BY result_order ASC
      `)
            .all(row.id) as SnapshotResultRow[];

        const results = resultRows.map((result) =>
            parseSearchResult({
                title: result.title,
                url: result.url,
                snippet: result.snippet,
                source: result.source,
                ...(result.published_at !== null
                    ? { publishedAt: result.published_at }
                    : {}),
                ...(result.score !== null
                    ? { score: result.score }
                    : {}),
            })
        );

        const parsed = parseResearchSnapshot({
            id: row.id,
            ...(row.conversation_id !== null
                ? { conversationId: row.conversation_id }
                : {}),
            query: row.query,
            provider: row.provider,
            searchedAt: row.searched_at,
            recordedAt: row.recorded_at,
            results,
        });

        return {
            id: parsed.id,
            ...(parsed.conversationId !== undefined
                ? { conversationId: parsed.conversationId }
                : {}),
            query: parsed.query,
            provider: parsed.provider,
            searchedAt: parsed.searchedAt,
            recordedAt: parsed.recordedAt,
            results: parsed.results.map((result) => ({
                title: result.title,
                url: result.url,
                snippet: result.snippet,
                source: result.source,
                ...(result.publishedAt !== undefined
                    ? { publishedAt: result.publishedAt }
                    : {}),
                ...(result.score !== undefined
                    ? { score: result.score }
                    : {}),
            })),
        };
    }
}