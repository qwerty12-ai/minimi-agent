import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  openDatabase,
  type SQLiteDatabase,
} from "../src/database/sqlite.js";

import { createMemoryStore } from "../src/memory/create-memory-store.js";

import type {
  Conversation,
  ConversationMessage,
  MemoryRecord,
  ResearchSnapshot,
} from "../src/memory/types.js";

const timestamp = "2026-11-11T10:00:00.000Z";

function createConversation(
  overrides: Partial<Conversation> = {}
): Conversation {
  return {
    id: "conversation-1",
    title: "Database research",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function createMessage(
  overrides: Partial<ConversationMessage> = {}
): ConversationMessage {
  return {
    id: "message-1",
    conversationId: "conversation-1",
    role: "user",
    content: "I am researching PostgreSQL database indexing.",
    createdAt: timestamp,
    ...overrides,
  };
}

function createMemory(
  overrides: Partial<MemoryRecord> = {}
): MemoryRecord {
  return {
    id: "memory-1",
    kind: "fact",
    content: "PostgreSQL supports B-tree and GIN indexes.",
    sourceType: "conversation",
    sourceId: "conversation-1",
    confidence: 0.95,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function createSnapshot(
  overrides: Partial<ResearchSnapshot> = {}
): ResearchSnapshot {
  return {
    id: "snapshot-1",
    conversationId: "conversation-1",
    query: "PostgreSQL indexing",
    provider: "test-provider",
    searchedAt: timestamp,
    recordedAt: timestamp,
    results: [
      {
        title: "PostgreSQL Indexes",
        url: "https://example.com/postgres-indexes",
        snippet: "An introduction to PostgreSQL indexes.",
        source: "Example",
        publishedAt: timestamp,
        score: 0.9,
      },
    ],
    ...overrides,
  };
}

describe("Memory integration", () => {
  let database: SQLiteDatabase;
  let store: ReturnType<typeof createMemoryStore>;

  beforeEach(() => {
    database = openDatabase(":memory:");
    store = createMemoryStore(database);
  });

  afterEach(() => {
    database.close();
  });

  it("creates and retrieves a conversation", async () => {
    const conversation = createConversation();

    await store.conversations.create(conversation);

    await expect(
      store.conversations.findById(conversation.id)
    ).resolves.toEqual(conversation);
  });

  it("persists messages and retrieves them in chronological order", async () => {
    await store.conversations.create(createConversation());

    await store.conversations.appendMessage(
      createMessage({
        id: "message-later",
        content: "This is the later message.",
        createdAt: "2026-11-11T10:02:00.000Z",
      })
    );

    await store.conversations.appendMessage(
      createMessage({
        id: "message-earlier",
        content: "This is the earlier message.",
        createdAt: "2026-11-11T10:01:00.000Z",
      })
    );

    const messages = await store.conversations.getMessages(
      "conversation-1"
    );

    expect(messages.map((message) => message.id)).toEqual([
      "message-earlier",
      "message-later",
    ]);
  });

  it("updates a conversation timestamp when a message is appended", async () => {
    await store.conversations.create(createConversation());

    const messageTime = "2026-11-11T11:00:00.000Z";

    await store.conversations.appendMessage(
      createMessage({
        createdAt: messageTime,
      })
    );

    const conversation = await store.conversations.findById(
      "conversation-1"
    );

    expect(conversation?.updatedAt).toBe(messageTime);
  });

  it("saves and retrieves memory records", async () => {
    const memory = createMemory();

    await store.memories.save(memory);

    await expect(
      store.memories.findById(memory.id)
    ).resolves.toEqual(memory);
  });

  it("finds memory records by their source", async () => {
    await store.memories.save(createMemory());

    await store.memories.save(
      createMemory({
        id: "memory-2",
        content: "The user prefers TypeScript.",
        kind: "preference",
      })
    );

    await store.memories.save(
      createMemory({
        id: "memory-3",
        sourceId: "another-conversation",
        content: "An unrelated memory.",
      })
    );

    const results = await store.memories.findBySource(
      "conversation",
      "conversation-1"
    );

    expect(results).toHaveLength(2);
    expect(results.map((memory) => memory.id)).toEqual([
      "memory-1",
      "memory-2",
    ]);
  });

  it("updates existing memory records without duplicating them", async () => {
    await store.memories.save(createMemory());

    await store.memories.save(
      createMemory({
        content: "Updated PostgreSQL indexing knowledge.",
        confidence: 0.99,
        updatedAt: "2026-11-11T12:00:00.000Z",
      })
    );

    const result = await store.memories.findById("memory-1");

    expect(result?.content).toBe(
      "Updated PostgreSQL indexing knowledge."
    );
    expect(result?.confidence).toBe(0.99);

    const rows = database.prepare(`
      SELECT COUNT(*) AS count
      FROM memory_records
      WHERE id = ?
    `).get("memory-1") as { count: number };

    expect(rows.count).toBe(1);
  });

  it("indexes conversation messages for full-text search", async () => {
    await store.conversations.create(createConversation());

    await store.conversations.appendMessage(createMessage());

    const results = await store.search.search("PostgreSQL indexing");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.sourceType).toBe("conversation_message");
    expect(results[0]?.sourceId).toBe("message-1");
  });

  it("indexes memory records and updates the search index", async () => {
    await store.memories.save(createMemory());

    const initialResults = await store.search.search(
      "PostgreSQL B-tree"
    );

    expect(initialResults).toHaveLength(1);
    expect(initialResults[0]?.sourceType).toBe("memory_record");

    await store.memories.save(
      createMemory({
        content: "SQLite uses a B-tree for ordinary table indexes.",
        updatedAt: "2026-11-11T12:00:00.000Z",
      })
    );

    const updatedResults = await store.search.search(
      "SQLite B-tree"
    );

    expect(updatedResults).toHaveLength(1);
    expect(updatedResults[0]?.sourceId).toBe("memory-1");
    expect(updatedResults[0]?.content).toContain("SQLite");
  });

  it("saves and retrieves research snapshots with their results", async () => {
    await store.conversations.create(createConversation());

    const snapshot = createSnapshot();

    await store.researchSnapshots.save(snapshot);

    await expect(
      store.researchSnapshots.findById(snapshot.id)
    ).resolves.toEqual(snapshot);

    await expect(
      store.researchSnapshots.findByConversation("conversation-1")
    ).resolves.toEqual([snapshot]);
  });

  it("returns null for missing records", async () => {
    await expect(
      store.conversations.findById("missing")
    ).resolves.toBeNull();

    await expect(
      store.memories.findById("missing")
    ).resolves.toBeNull();

    await expect(
      store.researchSnapshots.findById("missing")
    ).resolves.toBeNull();
  });

  it("preserves persisted data after reopening a database", async () => {
    const directory = mkdtempSync(
      join(tmpdir(), "minimi-memory-")
    );

    const databasePath = join(directory, "memory.sqlite");

    try {
      const firstDatabase = openDatabase(databasePath);
      const firstStore = createMemoryStore(firstDatabase);

      await firstStore.conversations.create(createConversation());
      await firstStore.conversations.appendMessage(createMessage());
      await firstStore.memories.save(createMemory());

      firstDatabase.close();

      const secondDatabase = openDatabase(databasePath);
      const secondStore = createMemoryStore(secondDatabase);

      try {
        await expect(
          secondStore.conversations.findById("conversation-1")
        ).resolves.toEqual(createConversation());

        await expect(
          secondStore.conversations.getMessages("conversation-1")
        ).resolves.toEqual([createMessage()]);

        await expect(
          secondStore.memories.findById("memory-1")
        ).resolves.toEqual(createMemory());

        const searchResults = await secondStore.search.search(
          "PostgreSQL B-tree"
        );

        expect(searchResults.length).toBeGreaterThan(0);
      } finally {
        secondDatabase.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});