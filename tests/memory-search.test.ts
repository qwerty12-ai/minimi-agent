import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  openDatabase,
  type SQLiteDatabase,
} from "../src/database/sqlite.js";

import {
  SQLiteMemorySearchRepository,
} from "../src/memory/sqlite-memory-search.js";

describe("SQLiteMemorySearchRepository integration", () => {
  let database: SQLiteDatabase;
  let repository: SQLiteMemorySearchRepository;

  beforeEach(() => {
    database = openDatabase(":memory:");
    repository = new SQLiteMemorySearchRepository(database);
  });

  afterEach(() => {
    database.close();
  });

  function createConversation(): void {
    database.prepare(`
      INSERT INTO conversations (
        id,
        title,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "conversation-1",
      "Testing conversation",
      "2026-11-11T10:00:00.000Z",
      "2026-11-11T10:00:00.000Z"
    );
  }

  function insertMessage(
    id: string,
    content: string
  ): void {
    database.prepare(`
      INSERT INTO conversation_messages (
        id,
        conversation_id,
        role,
        content,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      id,
      "conversation-1",
      "user",
      content,
      "2026-11-11T10:00:00.000Z"
    );
  }

  function insertMemory(
    id: string,
    content: string,
    kind = "fact"
  ): void {
    database.prepare(`
      INSERT INTO memory_records (
        id,
        kind,
        content,
        source_type,
        source_id,
        confidence,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      kind,
      content,
      "conversation",
      "conversation-1",
      0.95,
      "2026-11-11T10:00:00.000Z",
      "2026-11-11T10:00:00.000Z"
    );
  }

  it("indexes newly inserted conversation messages", async () => {
    createConversation();

    insertMessage(
      "message-1",
      "TypeScript uses static typing."
    );

    const results = await repository.search("TypeScript");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      sourceType: "conversation_message",
      sourceId: "message-1",
      content: "TypeScript uses static typing.",
    });
  });

  it("indexes newly inserted memory records", async () => {
    insertMemory(
      "memory-1",
      "The project uses SQLite for persistent storage.",
      "fact"
    );

    const results = await repository.search("SQLite");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      sourceType: "memory_record",
      sourceId: "memory-1",
      kind: "fact",
    });
  });

  it("searches conversation messages and memory records together", async () => {
    createConversation();

    insertMessage(
      "message-1",
      "The application uses SQLite."
    );

    insertMemory(
      "memory-1",
      "SQLite stores persistent memories.",
      "context"
    );

    const results = await repository.search("SQLite");

    expect(results).toHaveLength(2);

    expect(
      results.map((result) => result.sourceType)
    ).toContain("conversation_message");

    expect(
      results.map((result) => result.sourceType)
    ).toContain("memory_record");
  });

  it("returns no results for an empty query", async () => {
    createConversation();

    insertMessage(
      "message-1",
      "This message contains searchable content."
    );

    const results = await repository.search("   ");

    expect(results).toEqual([]);
  });

  it("returns no results when no documents match", async () => {
    createConversation();

    insertMessage(
      "message-1",
      "The application uses SQLite."
    );

    const results = await repository.search("Kubernetes");

    expect(results).toEqual([]);
  });

  it("respects the requested result limit", async () => {
    createConversation();

    insertMessage("message-1", "SQLite is used for storage.");
    insertMessage("message-2", "SQLite supports transactions.");
    insertMessage("message-3", "SQLite supports indexing.");

    const results = await repository.search("SQLite", 2);

    expect(results).toHaveLength(2);
  });

  it("rejects invalid result limits", async () => {
    await expect(
      repository.search("SQLite", 0)
    ).rejects.toThrow(
      "Search limit must be between 1 and 50."
    );

    await expect(
      repository.search("SQLite", 51)
    ).rejects.toThrow(
      "Search limit must be between 1 and 50."
    );
  });

  it("updates indexed content when a conversation message changes", async () => {
    createConversation();

    insertMessage(
      "message-1",
      "The application uses SQLite."
    );

    database.prepare(`
      UPDATE conversation_messages
      SET content = ?
      WHERE id = ?
    `).run(
      "The application uses PostgreSQL.",
      "message-1"
    );

    const oldResults = await repository.search("SQLite");
    const newResults = await repository.search("PostgreSQL");

    expect(oldResults).toHaveLength(0);
    expect(newResults).toHaveLength(1);
    expect(newResults[0].content).toBe(
      "The application uses PostgreSQL."
    );
  });

  it("removes indexed content when a conversation message is deleted", async () => {
    createConversation();

    insertMessage(
      "message-1",
      "The application uses SQLite."
    );

    database.prepare(`
      DELETE FROM conversation_messages
      WHERE id = ?
    `).run("message-1");

    const results = await repository.search("SQLite");

    expect(results).toEqual([]);
  });

  it("updates indexed memory records", async () => {
    insertMemory(
      "memory-1",
      "The application uses SQLite."
    );

    database.prepare(`
      UPDATE memory_records
      SET content = ?, kind = ?
      WHERE id = ?
    `).run(
      "The application uses PostgreSQL.",
      "decision",
      "memory-1"
    );

    const results = await repository.search("PostgreSQL");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      sourceId: "memory-1",
      content: "The application uses PostgreSQL.",
      kind: "decision",
    });

    expect(
      await repository.search("SQLite")
    ).toHaveLength(0);
  });

  it("removes indexed memory records when deleted", async () => {
    insertMemory(
      "memory-1",
      "The application uses SQLite."
    );

    database.prepare(`
      DELETE FROM memory_records
      WHERE id = ?
    `).run("memory-1");

    const results = await repository.search("SQLite");

    expect(results).toEqual([]);
  });
});