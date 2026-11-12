import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  openDatabase,
  initializeDatabase,
  type SQLiteDatabase,
} from "../src/database/sqlite.js";

import {
    existsSync,
    mkdtempSync,
    rmSync
} from "node:fs"

import { tmpdir } from "node:os";
import { join } from "node:path";

describe("SQLite database", () => {
  let database: SQLiteDatabase;

  beforeEach(() => {
    database = openDatabase(":memory:");
  });

  afterEach(() => {
    database.close();
  });

  function insertConversation(id = "conversation-1") {
    database.prepare(`
      INSERT INTO conversations (
        id, title, created_at, updated_at
      )
      VALUES (?, ?, ?, ?)
    `).run(
      id,
      "Test conversation",
      "2026-11-11T10:00:00.000Z",
      "2026-11-11T10:00:00.000Z",
    );
  }

  it("creates all required database tables", () => {
    const tables = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
    `).all() as Array<{ name: string }>;

    const names = tables.map((table) => table.name);

    expect(names).toContain("conversations");
    expect(names).toContain("conversation_messages");
    expect(names).toContain("memory_records");
    expect(names).toContain("research_snapshots");
    expect(names).toContain("research_snapshot_results");
  });

  it("enables foreign key enforcement", () => {
    const result = database.prepare(
      "PRAGMA foreign_keys"
    ).get() as { foreign_keys: number };

    expect(result.foreign_keys).toBe(1);
  });

  it("allows database initialization to run repeatedly", () => {
    expect(() => initializeDatabase(database)).not.toThrow();
    expect(() => initializeDatabase(database)).not.toThrow();
  });

  it("rejects messages referencing nonexistent conversations", () => {
    expect(() => {
      database.prepare(`
        INSERT INTO conversation_messages (
          id, conversation_id, role, content, created_at
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(
        "message-1",
        "missing-conversation",
        "user",
        "Hello",
        "2026-11-11T10:00:00.000Z",
      );
    }).toThrow();
  });

  it("rejects invalid conversation message roles", () => {
    insertConversation();

    expect(() => {
      database.prepare(`
        INSERT INTO conversation_messages (
          id, conversation_id, role, content, created_at
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(
        "message-1",
        "conversation-1",
        "visitor",
        "Hello",
        "2026-11-11T10:00:00.000Z",
      );
    }).toThrow();
  });

  it("rejects memory records with invalid confidence", () => {
    expect(() => {
      database.prepare(`
        INSERT INTO memory_records (
          id, kind, content, source_type, source_id,
          confidence, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        "memory-1",
        "fact",
        "Test memory",
        "conversation",
        "conversation-1",
        1.5,
        "2026-11-11T10:00:00.000Z",
        "2026-11-11T10:00:00.000Z",
      );
    }).toThrow();
  });

  it("deletes conversation messages when their conversation is deleted", () => {
    insertConversation();

    database.prepare(`
      INSERT INTO conversation_messages (
        id, conversation_id, role, content, created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      "message-1",
      "conversation-1",
      "user",
      "Hello",
      "2026-11-11T10:00:00.000Z",
    );

    database.prepare(
      "DELETE FROM conversations WHERE id = ?"
    ).run("conversation-1");

    const messages = database.prepare(
      "SELECT * FROM conversation_messages"
    ).all();

    expect(messages).toHaveLength(0);
  });

  it("preserves research snapshots when their conversation is deleted", () => {
    insertConversation();

    database.prepare(`
      INSERT INTO research_snapshots (
        id, conversation_id, query, provider,
        searched_at, recorded_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      "snapshot-1",
      "conversation-1",
      "TypeScript",
      "searxng",
      "2026-11-11T10:00:00.000Z",
      "2026-11-11T10:00:00.000Z",
    );

    database.prepare(
      "DELETE FROM conversations WHERE id = ?"
    ).run("conversation-1");

    const snapshot = database.prepare(
      "SELECT conversation_id FROM research_snapshots WHERE id = ?"
    ).get("snapshot-1") as {
      conversation_id: string | null;
    };

    expect(snapshot.conversation_id).toBeNull();
  });

  it("deletes research results when their snapshot is deleted", () => {
    database.prepare(`
      INSERT INTO research_snapshots (
        id, query, provider, searched_at, recorded_at
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      "snapshot-1",
      "TypeScript",
      "searxng",
      "2026-11-11T10:00:00.000Z",
      "2026-11-11T10:00:00.000Z",
    );

    database.prepare(`
      INSERT INTO research_snapshot_results (
        snapshot_id, result_order, title, url, snippet, source
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      "snapshot-1",
      0,
      "TypeScript Documentation",
      "https://www.typescriptlang.org/",
      "Official documentation",
      "TypeScript",
    );

    database.prepare(
      "DELETE FROM research_snapshots WHERE id = ?"
    ).run("snapshot-1");

    const results = database.prepare(
      "SELECT * FROM research_snapshot_results"
    ).all();

    expect(results).toHaveLength(0);
  });
});

describe("SQLite connection validation", () => {
  it("rejects an empty database path", () => {
    expect(() => openDatabase("   ")).toThrow(
      "Database path must not be empty."
    );
  });
});

describe("SQLite persistent database paths", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(
      join(tmpdir(), "minimi-sqlite-")
    );
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("creates missing parent directories automatically", () => {
    const databasePath = join(
      directory,
      "data",
      "sqlite",
      "minimi-agent.db"
    );

    const database = openDatabase(databasePath);

    try {
      expect(existsSync(databasePath)).toBe(true);

      const result = database.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
      ).get("conversations");

      expect(result).toBeDefined();
    } finally {
      database.close();
    }
  });

  it("preserves existing database data when reopened", () => {
    const databasePath = join(
      directory,
      "data",
      "minimi-agent.db"
    );

    const firstDatabase = openDatabase(databasePath);

    firstDatabase.prepare(`
      INSERT INTO conversations (
        id, title, created_at, updated_at
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "persistent-1",
      "Persistent conversation",
      "2026-11-11T10:00:00.000Z",
      "2026-11-11T10:00:00.000Z",
    );

    firstDatabase.close();

    const secondDatabase = openDatabase(databasePath);

    try {
      const result = secondDatabase.prepare(
        "SELECT title FROM conversations WHERE id = ?"
      ).get("persistent-1") as { title: string } | undefined;

      expect(result?.title).toBe("Persistent conversation");
    } finally {
      secondDatabase.close();
    }
  });
});
