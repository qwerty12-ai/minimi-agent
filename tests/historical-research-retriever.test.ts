import { describe, expect, it, vi } from "vitest";

import {
  HistoricalResearchNotFoundError,
  HistoricalResearchOwnershipError,
  HistoricalResearchRetriever,
} from "../src/agent/historical-research-retriever.js";

import type {
  ResearchSnapshot,
  ResearchSnapshotRepository,
} from "../src/memory/types.js";

const snapshot: ResearchSnapshot = {
  id: "snapshot-1",
  conversationId: "conversation-1",
  query: "TypeScript documentation",
  provider: "searxng",
  searchedAt: "2026-11-11T10:00:00.000Z",
  recordedAt: "2026-11-11T10:01:00.000Z",
  results: [
    {
      title: "TypeScript Handbook",
      url: "https://www.typescriptlang.org/docs/",
      snippet: "Official TypeScript documentation.",
      source: "TypeScript",
    },
  ],
};

function createRepository(
  overrides: Partial<ResearchSnapshotRepository> = {},
): ResearchSnapshotRepository {
  return {
    save: vi.fn(),
    findById: vi.fn().mockResolvedValue(snapshot),
    findByConversation: vi.fn().mockResolvedValue([snapshot]),
    ...overrides,
  };
}

describe("HistoricalResearchRetriever", () => {
  describe("retrieve", () => {
    it("retrieves and validates a historical snapshot", async () => {
      const repository = createRepository();
      const retriever = new HistoricalResearchRetriever(repository);

      const result = await retriever.retrieve({
        historicalSnapshotId: "snapshot-1",
        conversationId: "conversation-1",
      });

      expect(result).toEqual(snapshot);
      expect(repository.findById).toHaveBeenCalledWith("snapshot-1");
    });

    it("retrieves a snapshot without an optional conversation ID", async () => {
      const repository = createRepository();
      const retriever = new HistoricalResearchRetriever(repository);

      const result = await retriever.retrieve({
        historicalSnapshotId: "snapshot-1",
      });

      expect(result.id).toBe("snapshot-1");
    });

    it("rejects a snapshot that does not exist", async () => {
      const repository = createRepository({
        findById: vi.fn().mockResolvedValue(null),
      });

      const retriever = new HistoricalResearchRetriever(repository);

      await expect(
        retriever.retrieve({
          historicalSnapshotId: "missing",
        }),
      ).rejects.toBeInstanceOf(HistoricalResearchNotFoundError);
    });

    it("rejects a snapshot belonging to another conversation", async () => {
      const repository = createRepository();
      const retriever = new HistoricalResearchRetriever(repository);

      await expect(
        retriever.retrieve({
          historicalSnapshotId: "snapshot-1",
          conversationId: "another-conversation",
        }),
      ).rejects.toBeInstanceOf(HistoricalResearchOwnershipError);
    });

    it("rejects an invalid verification request", async () => {
      const repository = createRepository();
      const retriever = new HistoricalResearchRetriever(repository);

      await expect(
        retriever.retrieve({
          historicalSnapshotId: "",
        }),
      ).rejects.toThrow();

      expect(repository.findById).not.toHaveBeenCalled();
    });
  });

  describe("retrieveConversationHistory", () => {
    it("retrieves snapshots belonging to a conversation", async () => {
      const repository = createRepository();
      const retriever = new HistoricalResearchRetriever(repository);

      const result = await retriever.retrieveConversationHistory(
        "conversation-1",
      );

      expect(result).toEqual([snapshot]);
      expect(repository.findByConversation).toHaveBeenCalledWith(
        "conversation-1",
      );
    });

    it("sorts snapshots by recorded time in ascending order", async () => {
      const older = {
        ...snapshot,
        id: "snapshot-older",
        recordedAt: "2026-11-10T10:00:00.000Z",
      };

      const newer = {
        ...snapshot,
        id: "snapshot-newer",
        recordedAt: "2026-11-12T10:00:00.000Z",
      };

      const repository = createRepository({
        findByConversation: vi.fn().mockResolvedValue([
          newer,
          older,
        ]),
      });

      const retriever = new HistoricalResearchRetriever(repository);

      const result = await retriever.retrieveConversationHistory(
        "conversation-1",
      );

      expect(result.map((item) => item.id)).toEqual([
        "snapshot-older",
        "snapshot-newer",
      ]);
    });

    it("uses snapshot ID as a deterministic tie-breaker", async () => {
      const second = {
        ...snapshot,
        id: "snapshot-2",
      };

      const first = {
        ...snapshot,
        id: "snapshot-1",
      };

      const repository = createRepository({
        findByConversation: vi.fn().mockResolvedValue([
          second,
          first,
        ]),
      });

      const retriever = new HistoricalResearchRetriever(repository);

      const result = await retriever.retrieveConversationHistory(
        "conversation-1",
      );

      expect(result.map((item) => item.id)).toEqual([
        "snapshot-1",
        "snapshot-2",
      ]);
    });

    it("returns an empty array when no history exists", async () => {
      const repository = createRepository({
        findByConversation: vi.fn().mockResolvedValue([]),
      });

      const retriever = new HistoricalResearchRetriever(repository);

      await expect(
        retriever.retrieveConversationHistory("conversation-1"),
      ).resolves.toEqual([]);
    });
  });
});