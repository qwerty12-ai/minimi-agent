import { describe, expect, it, vi } from "vitest";

import {
  MemoryRetriever,
  MemoryRetrievalError,
} from "../src/agent/memory-retriever.js";

import type {
  MemorySearchRepository,
  MemorySearchResult,
} from "../src/memory/types.js";

const timestamp = "2026-11-11T08:00:00.000Z";

const mockResults: MemorySearchResult[] = [
  {
    sourceType: "memory_record",
    sourceId: "memory-1",
    content: "The user previously researched PostgreSQL.",
    createdAt: timestamp,
    rank: -1.25,
    kind: "fact",
  },
  {
    sourceType: "conversation_message",
    sourceId: "message-1",
    content: "We discussed PostgreSQL database design.",
    createdAt: timestamp,
    rank: -0.85,
  },
];

function createRepository(
  results: MemorySearchResult[] = mockResults,
): MemorySearchRepository {
  return {
    search: vi.fn().mockResolvedValue(results),
  };
}

describe("MemoryRetriever", () => {
  it("retrieves memory and creates a valid context", async () => {
    const repository = createRepository();
    const clock = () => new Date(timestamp);

    const retriever = new MemoryRetriever(repository, clock);

    const context = await retriever.retrieve("PostgreSQL");

    expect(context).toEqual({
      query: "PostgreSQL",
      retrievedAt: timestamp,
      results: mockResults,
    });
  });

  it("trims the query before searching", async () => {
    const repository = createRepository();
    const retriever = new MemoryRetriever(repository);

    await retriever.retrieve("  PostgreSQL  ");

    expect(repository.search).toHaveBeenCalledWith(
      "PostgreSQL",
      10,
    );
  });

  it("passes a custom result limit to the repository", async () => {
    const repository = createRepository();
    const retriever = new MemoryRetriever(repository);

    await retriever.retrieve("PostgreSQL", 5);

    expect(repository.search).toHaveBeenCalledWith(
      "PostgreSQL",
      5,
    );
  });

  it("supports an empty memory result set", async () => {
    const repository = createRepository([]);
    const retriever = new MemoryRetriever(
      repository,
      () => new Date(timestamp),
    );

    const context = await retriever.retrieve("Unknown topic");

    expect(context.results).toEqual([]);
    expect(context.query).toBe("Unknown topic");
  });

  it("rejects an empty query without searching", async () => {
    const repository = createRepository();
    const retriever = new MemoryRetriever(repository);

    await expect(
      retriever.retrieve("   "),
    ).rejects.toThrow(
      "Memory search query must contain between 1 and 500 characters.",
    );

    expect(repository.search).not.toHaveBeenCalled();
  });

  it("rejects queries longer than 500 characters", async () => {
    const repository = createRepository();
    const retriever = new MemoryRetriever(repository);

    await expect(
      retriever.retrieve("a".repeat(501)),
    ).rejects.toThrow(
      "Memory search query must contain between 1 and 500 characters.",
    );

    expect(repository.search).not.toHaveBeenCalled();
  });

  it("rejects invalid result limits", async () => {
    const repository = createRepository();
    const retriever = new MemoryRetriever(repository);

    await expect(
      retriever.retrieve("PostgreSQL", 0),
    ).rejects.toThrow(
      "Memory search limit must be between 1 and 50.",
    );

    await expect(
      retriever.retrieve("PostgreSQL", 51),
    ).rejects.toThrow(
      "Memory search limit must be between 1 and 50.",
    );

    await expect(
      retriever.retrieve("PostgreSQL", 1.5),
    ).rejects.toThrow(
      "Memory search limit must be between 1 and 50.",
    );

    expect(repository.search).not.toHaveBeenCalled();
  });

  it("wraps repository failures in MemoryRetrievalError", async () => {
    const repository: MemorySearchRepository = {
      search: vi.fn().mockRejectedValue(
        new Error("SQLite connection failed."),
      ),
    };

    const retriever = new MemoryRetriever(repository);

    await expect(
      retriever.retrieve("PostgreSQL"),
    ).rejects.toThrow(MemoryRetrievalError);
  });

  it("handles non-Error repository failures", async () => {
    const repository: MemorySearchRepository = {
      search: vi.fn().mockRejectedValue("Unexpected failure"),
    };

    const retriever = new MemoryRetriever(repository);

    await expect(
      retriever.retrieve("PostgreSQL"),
    ).rejects.toThrow("Memory retrieval failed.");
  });

  it("rejects invalid data returned by the repository", async () => {
    const repository = {
      search: vi.fn().mockResolvedValue([
        {
          sourceType: "invalid_source",
          sourceId: "memory-1",
          content: "Invalid memory result",
          createdAt: timestamp,
          rank: 1,
        },
      ]),
    } as unknown as MemorySearchRepository;

    const retriever = new MemoryRetriever(repository);

    await expect(
      retriever.retrieve("PostgreSQL"),
    ).rejects.toThrow(
      "Memory repository returned invalid retrieval data.",
    );
  });
});