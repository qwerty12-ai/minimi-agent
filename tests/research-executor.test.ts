import { describe, expect, it, vi } from "vitest";

import {
  ResearchExecutor,
  ResearchExecutionError,
} from "../src/agent/research-executor.js";

import type {
  SearchResponse,
} from "../src/research/types.js";

import type {
  ExecutionPlan,
} from "../src/agent/types.js";

const timestamp = "2026-11-11T10:00:00.000Z";

const researchResponse: SearchResponse = {
  query: "PostgreSQL",
  provider: "searxng",
  searchedAt: timestamp,
  results: [
    {
      title: "PostgreSQL",
      url: "https://www.postgresql.org/",
      snippet: "Open-source relational database.",
      source: "PostgreSQL",
    },
  ],
};

const researchPlan: ExecutionPlan = {
  intent: "RESEARCH",
  requiresMemory: false,
  requiresSearch: true,
};

const recallPlan: ExecutionPlan = {
  intent: "RECALL",
  requiresMemory: true,
  requiresSearch: false,
};

function createSearchService(
  response: SearchResponse = researchResponse,
) {
  return {
    search: vi.fn().mockResolvedValue(response),
  };
}

describe("ResearchExecutor", () => {
  it("executes research using the search service", async () => {
    const searchService = createSearchService();

    const executor = new ResearchExecutor(
      searchService,
      () => new Date(timestamp),
    );

    const result = await executor.execute(
      "PostgreSQL",
      researchPlan,
    );

    expect(result).toEqual({
      query: "PostgreSQL",
      provider: "searxng",
      searchedAt: timestamp,
      results: researchResponse.results,
    });

    expect(searchService.search).toHaveBeenCalledWith({
      query: "PostgreSQL",
      maxResults: 10,
    });
  });

  it("trims the research query", async () => {
    const searchService = createSearchService();
    const executor = new ResearchExecutor(searchService);

    await executor.execute(
      "  PostgreSQL  ",
      researchPlan,
    );

    expect(searchService.search).toHaveBeenCalledWith({
      query: "PostgreSQL",
      maxResults: 10,
    });
  });

  it("supports a custom result limit", async () => {
    const searchService = createSearchService();
    const executor = new ResearchExecutor(searchService);

    await executor.execute(
      "PostgreSQL",
      researchPlan,
      5,
    );

    expect(searchService.search).toHaveBeenCalledWith({
      query: "PostgreSQL",
      maxResults: 5,
    });
  });

  it("does not execute research when search is not required", async () => {
    const searchService = createSearchService();
    const executor = new ResearchExecutor(searchService);

    const result = await executor.execute(
      "PostgreSQL",
      recallPlan,
    );

    expect(result).toBeNull();
    expect(searchService.search).not.toHaveBeenCalled();
  });

  it("preserves an empty research result set", async () => {
    const searchService = createSearchService({
      ...researchResponse,
      results: [],
    });

    const executor = new ResearchExecutor(
      searchService,
      () => new Date(timestamp),
    );

    const result = await executor.execute(
      "Unknown topic",
      researchPlan,
    );

    expect(result?.results).toEqual([]);
    expect(result?.provider).toBe("searxng");
  });

  it("rejects an empty query", async () => {
    const searchService = createSearchService();
    const executor = new ResearchExecutor(searchService);

    await expect(
      executor.execute("   ", researchPlan),
    ).rejects.toThrow(
      "Research query must contain between 1 and 500 characters.",
    );

    expect(searchService.search).not.toHaveBeenCalled();
  });

  it("rejects queries longer than 500 characters", async () => {
    const searchService = createSearchService();
    const executor = new ResearchExecutor(searchService);

    await expect(
      executor.execute("a".repeat(501), researchPlan),
    ).rejects.toThrow(
      "Research query must contain between 1 and 500 characters.",
    );

    expect(searchService.search).not.toHaveBeenCalled();
  });

  it("rejects invalid result limits", async () => {
    const searchService = createSearchService();
    const executor = new ResearchExecutor(searchService);

    await expect(
      executor.execute("PostgreSQL", researchPlan, 0),
    ).rejects.toThrow(
      "Research result limit must be between 1 and 20.",
    );

    await expect(
      executor.execute("PostgreSQL", researchPlan, 21),
    ).rejects.toThrow(
      "Research result limit must be between 1 and 20.",
    );

    await expect(
      executor.execute("PostgreSQL", researchPlan, 1.5),
    ).rejects.toThrow(
      "Research result limit must be between 1 and 20.",
    );

    expect(searchService.search).not.toHaveBeenCalled();
  });

  it("wraps search service failures", async () => {
    const searchService = {
      search: vi.fn().mockRejectedValue(
        new Error("Search provider unavailable."),
      ),
    };

    const executor = new ResearchExecutor(searchService);

    await expect(
      executor.execute("PostgreSQL", researchPlan),
    ).rejects.toThrow(ResearchExecutionError);
  });

  it("handles non-Error search failures", async () => {
    const searchService = {
      search: vi.fn().mockRejectedValue("Unexpected failure"),
    };

    const executor = new ResearchExecutor(searchService);

    await expect(
      executor.execute("PostgreSQL", researchPlan),
    ).rejects.toThrow("Research execution failed.");
  });

  it("rejects invalid research context returned by the search service", async () => {
    const searchService = {
      search: vi.fn().mockResolvedValue({
        query: "PostgreSQL",
        provider: "searxng",
        searchedAt: "invalid-date",
        results: [],
      }),
    };

    const executor = new ResearchExecutor(searchService);

    await expect(
      executor.execute("PostgreSQL", researchPlan),
    ).rejects.toThrow(
      "Search service returned invalid research context.",
    );
  });
});