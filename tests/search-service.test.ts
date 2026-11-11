import { describe, expect, it } from "vitest";

import {
  SearchService,
  SearchProviderError,
} from "../src/research/search-service.js";

import type {
  SearchProvider,
  SearchResponse,
} from "../src/research/types.js";

function createMockProvider(
  response?: unknown
): SearchProvider {
  return {
    name: "mock-search",
    search: async () => (
      response ?? {
        query: "Neon pricing",
        provider: "mock-search",
        searchedAt: "2026-11-10T12:00:00.000Z",
        results: [],
      }
    ) as SearchResponse,
  };
}

describe("SearchService", () => {
  it("executes a search using the injected provider", async () => {
    const service = new SearchService(createMockProvider());

    const result = await service.search({
      query: "Neon pricing",
    });

    expect(result.provider).toBe("mock-search");
    expect(result.query).toBe("Neon pricing");
    expect(result.results).toEqual([]);
  });

  it("rejects invalid search requests", async () => {
    const service = new SearchService(createMockProvider());

    await expect(
      service.search({ query: "   " })
    ).rejects.toThrow();
  });

  it("rejects invalid provider responses", async () => {
    const service = new SearchService(
      createMockProvider({
        query: "Neon pricing",
        provider: "mock-search",
        searchedAt: "invalid-date",
        results: [],
      })
    );

    await expect(
      service.search({ query: "Neon pricing" })
    ).rejects.toThrow(SearchProviderError);
  });

  it("rejects provider identity mismatches", async () => {
    const service = new SearchService(
      createMockProvider({
        query: "Neon pricing",
        provider: "different-provider",
        searchedAt: "2026-11-10T12:00:00.000Z",
        results: [],
      })
    );

    await expect(
      service.search({ query: "Neon pricing" })
    ).rejects.toThrow("Search provider identity mismatch.");
  });

  it("handles provider failures", async () => {
    const provider: SearchProvider = {
      name: "mock-search",
      search: async () => {
        throw new Error("Connection refused.");
      },
    };

    const service = new SearchService(provider);

    await expect(
      service.search({ query: "Neon pricing" })
    ).rejects.toThrow(SearchProviderError);
  });

  it("preserves provider error messages", async () => {
    const provider: SearchProvider = {
      name: "mock-search",
      search: async () => {
        throw new Error("Provider unavailable.");
      },
    };

    const service = new SearchService(provider);

    await expect(
      service.search({ query: "Neon pricing" })
    ).rejects.toThrow("Provider unavailable.");
  });

  it("rejects results returned for a different query", async () => {
    const service = new SearchService(
      createMockProvider({
        query: "Different query",
        provider: "mock-search",
        searchedAt: "2026-11-10T12:00:00.000Z",
        results: [],
      })
    );

    await expect(
      service.search({ query: "Neon pricing" })
    ).rejects.toThrow(
      "Search provider returned results for a different query."
    );
  });

  it("normalizes whitespace in search results", async () => {
    const service = new SearchService(
      createMockProvider({
        query: "Neon pricing",
        provider: "mock-search",
        searchedAt: "2026-11-10T12:00:00.000Z",
        results: [
          {
            title: "  Neon   Pricing  ",
            url: "https://example.com/pricing",
            snippet: "  Official   pricing   information. ",
            source: "  Example   Search ",
          },
        ],
      })
    );

    const result = await service.search({
      query: "Neon pricing",
    });

    expect(result.results[0].title).toBe("Neon Pricing");
    expect(result.results[0].snippet)
      .toBe("Official pricing information.");
    expect(result.results[0].source).toBe("Example Search");
  });

  it("removes duplicate URLs with different fragments", async () => {
    const service = new SearchService(
      createMockProvider({
        query: "Neon pricing",
        provider: "mock-search",
        searchedAt: "2026-11-10T12:00:00.000Z",
        results: [
          {
            title: "Pricing page",
            url: "https://example.com/pricing#plans",
            snippet: "Plans",
            source: "engine-one",
          },
          {
            title: "Pricing page duplicate",
            url: "https://example.com/pricing#faq",
            snippet: "FAQ",
            source: "engine-two",
          },
        ],
      })
    );

    const result = await service.search({
      query: "Neon pricing",
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].url)
      .toBe("https://example.com/pricing");
  });

  it("enforces the requested result limit", async () => {
    const service = new SearchService(
      createMockProvider({
        query: "Neon pricing",
        provider: "mock-search",
        searchedAt: "2026-11-10T12:00:00.000Z",
        results: Array.from({ length: 5 }, (_, index) => ({
          title: `Result ${index}`,
          url: `https://example.com/${index}`,
          snippet: `Snippet ${index}`,
          source: "mock-search",
        })),
      })
    );

    const result = await service.search({
      query: "Neon pricing",
      maxResults: 2,
    });

    expect(result.results).toHaveLength(2);
  });
});