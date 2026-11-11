import { describe, expect, it } from "vitest";

import {
  ConversationSchema,
  ConversationMessageSchema,
  MemoryRecordSchema,
  ResearchSnapshotSchema,
  parseConversation,
  parseConversationMessage,
  parseMemoryRecord,
  parseResearchSnapshot,
} from "../src/memory/memory-schema.js";

const timestamp = "2026-11-11T10:00:00.000Z";

const validConversation = {
  id: "conversation-1",
  title: "Research session",
  createdAt: timestamp,
  updatedAt: timestamp,
};

const validMessage = {
  id: "message-1",
  conversationId: "conversation-1",
  role: "user",
  content: "Research TypeScript architecture.",
  createdAt: timestamp,
};

const validMemory = {
  id: "memory-1",
  kind: "fact",
  content: "The project uses TypeScript.",
  sourceType: "conversation",
  sourceId: "conversation-1",
  confidence: 0.95,
  createdAt: timestamp,
  updatedAt: timestamp,
};

const validSnapshot = {
  id: "snapshot-1",
  conversationId: "conversation-1",
  query: "TypeScript architecture",
  provider: "searxng",
  searchedAt: timestamp,
  recordedAt: timestamp,
  results: [
    {
      title: "TypeScript Documentation",
      url: "https://www.typescriptlang.org/",
      snippet: "Official TypeScript documentation.",
      source: "TypeScript",
    },
  ],
};

describe("ConversationSchema", () => {
  it("accepts a valid conversation", () => {
    expect(ConversationSchema.safeParse(validConversation).success)
      .toBe(true);
  });

  it("accepts a conversation without an optional title", () => {
    const { title, ...conversation } = validConversation;

    expect(ConversationSchema.safeParse(conversation).success)
      .toBe(true);
  });

  it("rejects an empty conversation ID", () => {
    expect(
      ConversationSchema.safeParse({
        ...validConversation,
        id: "",
      }).success
    ).toBe(false);
  });

  it("rejects an invalid timestamp", () => {
    expect(
      ConversationSchema.safeParse({
        ...validConversation,
        createdAt: "not-a-date",
      }).success
    ).toBe(false);
  });

  it("rejects unknown properties", () => {
    expect(
      ConversationSchema.safeParse({
        ...validConversation,
        unknown: true,
      }).success
    ).toBe(false);
  });
});

describe("ConversationMessageSchema", () => {
  it("accepts a valid message", () => {
    expect(ConversationMessageSchema.safeParse(validMessage).success)
      .toBe(true);
  });

  it("accepts supported conversation roles", () => {
    const roles = ["system", "user", "assistant", "tool"];

    for (const role of roles) {
      expect(
        ConversationMessageSchema.safeParse({
          ...validMessage,
          role,
        }).success
      ).toBe(true);
    }
  });

  it("rejects an unsupported role", () => {
    expect(
      ConversationMessageSchema.safeParse({
        ...validMessage,
        role: "visitor",
      }).success
    ).toBe(false);
  });

  it("rejects a missing conversation ID", () => {
    const { conversationId, ...message } = validMessage;

    expect(ConversationMessageSchema.safeParse(message).success)
      .toBe(false);
  });

  it("rejects an invalid creation timestamp", () => {
    expect(
      ConversationMessageSchema.safeParse({
        ...validMessage,
        createdAt: "invalid",
      }).success
    ).toBe(false);
  });
});

describe("MemoryRecordSchema", () => {
  it("accepts a valid memory record", () => {
    expect(MemoryRecordSchema.safeParse(validMemory).success)
      .toBe(true);
  });

  it("accepts all supported memory kinds", () => {
    const kinds = ["fact", "preference", "decision", "context"];

    for (const kind of kinds) {
      expect(
        MemoryRecordSchema.safeParse({
          ...validMemory,
          kind,
        }).success
      ).toBe(true);
    }
  });

  it("accepts both supported source types", () => {
    for (const sourceType of ["conversation", "research"]) {
      expect(
        MemoryRecordSchema.safeParse({
          ...validMemory,
          sourceType,
        }).success
      ).toBe(true);
    }
  });

  it("rejects an unsupported memory kind", () => {
    expect(
      MemoryRecordSchema.safeParse({
        ...validMemory,
        kind: "unknown",
      }).success
    ).toBe(false);
  });

  it("rejects confidence below zero", () => {
    expect(
      MemoryRecordSchema.safeParse({
        ...validMemory,
        confidence: -0.1,
      }).success
    ).toBe(false);
  });

  it("rejects confidence above one", () => {
    expect(
      MemoryRecordSchema.safeParse({
        ...validMemory,
        confidence: 1.1,
      }).success
    ).toBe(false);
  });

  it("accepts confidence boundary values", () => {
    for (const confidence of [0, 1]) {
      expect(
        MemoryRecordSchema.safeParse({
          ...validMemory,
          confidence,
        }).success
      ).toBe(true);
    }
  });

  it("rejects empty memory content", () => {
    expect(
      MemoryRecordSchema.safeParse({
        ...validMemory,
        content: "   ",
      }).success
    ).toBe(false);
  });
});

describe("ResearchSnapshotSchema", () => {
  it("accepts a valid research snapshot", () => {
    expect(ResearchSnapshotSchema.safeParse(validSnapshot).success)
      .toBe(true);
  });

  it("accepts a snapshot without an optional conversation ID", () => {
    const { conversationId, ...snapshot } = validSnapshot;

    expect(ResearchSnapshotSchema.safeParse(snapshot).success)
      .toBe(true);
  });

  it("accepts an empty results array", () => {
    expect(
      ResearchSnapshotSchema.safeParse({
        ...validSnapshot,
        results: [],
      }).success
    ).toBe(true);
  });

  it("rejects an invalid search result", () => {
    expect(
      ResearchSnapshotSchema.safeParse({
        ...validSnapshot,
        results: [{ title: "Missing URL" }],
      }).success
    ).toBe(false);
  });

  it("rejects an invalid searched timestamp", () => {
    expect(
      ResearchSnapshotSchema.safeParse({
        ...validSnapshot,
        searchedAt: "invalid",
      }).success
    ).toBe(false);
  });

  it("rejects unknown properties", () => {
    expect(
      ResearchSnapshotSchema.safeParse({
        ...validSnapshot,
        extra: true,
      }).success
    ).toBe(false);
  });
});

describe("Memory parsing functions", () => {
  it("parses a valid conversation", () => {
    expect(parseConversation(validConversation)).toEqual(
      validConversation
    );
  });

  it("parses a valid conversation message", () => {
    expect(parseConversationMessage(validMessage)).toEqual(
      validMessage
    );
  });

  it("parses a valid memory record", () => {
    expect(parseMemoryRecord(validMemory)).toEqual(
      validMemory
    );
  });

  it("parses a valid research snapshot", () => {
    expect(parseResearchSnapshot(validSnapshot)).toEqual(
      validSnapshot
    );
  });

  it("throws when parsing invalid memory data", () => {
    expect(() => parseMemoryRecord({})).toThrow();
  });
});