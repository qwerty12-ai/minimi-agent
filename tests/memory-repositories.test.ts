import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  openDatabase,
  type SQLiteDatabase,
} from "../src/database/sqlite.js";

import {
  SQLiteConversationRepository,
  SQLiteResearchSnapshotRepository,
} from "../src/memory/sqlite-repositories.js";

import type {
  Conversation,
  ConversationMessage,
  ResearchSnapshot,
} from "../src/memory/types.js";

describe("SQLite repositories", () => {
  let database: SQLiteDatabase;
  let conversations: SQLiteConversationRepository;
  let snapshots: SQLiteResearchSnapshotRepository;

  const conversation: Conversation = {
    id: "conversation-1",
    title: "Research session",
    createdAt: "2026-11-11T10:00:00.000Z",
    updatedAt: "2026-11-11T10:00:00.000Z",
  };

  const snapshot: ResearchSnapshot = {
    id: "snapshot-1",
    conversationId: "conversation-1",
    query: "TypeScript architecture",
    provider: "searxng",
    searchedAt: "2026-11-11T10:01:00.000Z",
    recordedAt: "2026-11-11T10:02:00.000Z",
    results: [
      {
        title: "TypeScript Handbook",
        url: "https://www.typescriptlang.org/docs/",
        snippet: "Official TypeScript documentation.",
        source: "TypeScript",
      },
      {
        title: "Node.js Documentation",
        url: "https://nodejs.org/docs/",
        snippet: "Official Node.js documentation.",
        source: "Node.js",
      },
    ],
  };

  beforeEach(() => {
    database = openDatabase(":memory:");
    conversations = new SQLiteConversationRepository(database);
    snapshots = new SQLiteResearchSnapshotRepository(database);
  });

  afterEach(() => {
    database.close();
  });

  it("creates and retrieves a conversation", async () => {
    await conversations.create(conversation);

    await expect(
      conversations.findById("conversation-1")
    ).resolves.toEqual(conversation);
  });

  it("returns null for a conversation that does not exist", async () => {
    await expect(
      conversations.findById("missing")
    ).resolves.toBeNull();
  });

  it("appends and retrieves messages in chronological order", async () => {
    await conversations.create(conversation);

    const laterMessage: ConversationMessage = {
      id: "message-2",
      conversationId: "conversation-1",
      role: "assistant",
      content: "Here is the research.",
      createdAt: "2026-11-11T10:02:00.000Z",
    };

    const earlierMessage: ConversationMessage = {
      id: "message-1",
      conversationId: "conversation-1",
      role: "user",
      content: "Research TypeScript architecture.",
      createdAt: "2026-11-11T10:01:00.000Z",
    };

    await conversations.appendMessage(laterMessage);
    await conversations.appendMessage(earlierMessage);

    await expect(
      conversations.getMessages("conversation-1")
    ).resolves.toEqual([earlierMessage, laterMessage]);
  });

  it("updates the conversation timestamp when a message is appended", async () => {
    await conversations.create(conversation);

    await conversations.appendMessage({
      id: "message-1",
      conversationId: "conversation-1",
      role: "user",
      content: "Hello",
      createdAt: "2026-11-11T10:05:00.000Z",
    });

    const updated = await conversations.findById("conversation-1");

    expect(updated?.updatedAt).toBe("2026-11-11T10:05:00.000Z");
  });

  it("saves and retrieves a research snapshot with its results", async () => {
    await conversations.create(conversation);
    await snapshots.save(snapshot);

    await expect(
      snapshots.findById("snapshot-1")
    ).resolves.toEqual(snapshot);
  });

  it("returns null for a research snapshot that does not exist", async () => {
    await expect(
      snapshots.findById("missing")
    ).resolves.toBeNull();
  });

  it("retrieves all snapshots associated with a conversation", async () => {
    await conversations.create(conversation);
    await snapshots.save(snapshot);

    const secondSnapshot: ResearchSnapshot = {
      ...snapshot,
      id: "snapshot-2",
      query: "Node.js architecture",
      recordedAt: "2026-11-11T10:03:00.000Z",
    };

    await snapshots.save(secondSnapshot);

    await expect(
      snapshots.findByConversation("conversation-1")
    ).resolves.toEqual([snapshot, secondSnapshot]);
  });

  it("preserves research history when its conversation is deleted", async () => {
    await conversations.create(conversation);
    await snapshots.save(snapshot);

    database
      .prepare("DELETE FROM conversations WHERE id = ?")
      .run("conversation-1");

    const retrieved = await snapshots.findById("snapshot-1");

    expect(retrieved).not.toBeNull();
    expect(retrieved?.conversationId).toBeUndefined();
    expect(retrieved?.results).toEqual(snapshot.results);
  });

  it("rejects invalid research snapshots before persistence", async () => {
    const invalidSnapshot: ResearchSnapshot = {
      ...snapshot,
      results: [
        {
          ...snapshot.results[0],
          url: "not-a-valid-url",
        },
      ],
    };

    await expect(
      snapshots.save(invalidSnapshot)
    ).rejects.toThrow();

    await expect(
      snapshots.findById("snapshot-1")
    ).resolves.toBeNull();
  });
});