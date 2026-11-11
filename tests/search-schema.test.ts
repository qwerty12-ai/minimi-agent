import { describe, expect, it } from "vitest";

import {
  SearchRequestSchema,
  SearchResultSchema,
  SearchResponseSchema,
} from "../src/research/search-schema.js";

describe("SearchRequestSchema", () => {
  it("accepts a valid search request", () => {
    const result = SearchRequestSchema.safeParse({
      query: "Latest Neon pricing",
      maxResults: 10,
      region: "us",
      timeRange: "month",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty query", () => {
    const result = SearchRequestSchema.safeParse({
      query: "   ",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid result limit", () => {
    const result = SearchRequestSchema.safeParse({
      query: "Neon pricing",
      maxResults: 50,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown properties", () => {
    const result = SearchRequestSchema.safeParse({
      query: "Neon pricing",
      unknownField: true,
    });

    expect(result.success).toBe(false);
  });
});

describe("SearchResultSchema", () => {
  it("accepts a valid search result", () => {
    const result = SearchResultSchema.safeParse({
      title: "Neon Pricing",
      url: "https://neon.com/pricing",
      snippet: "Pricing information.",
      source: "Neon",
      score: 0.95,
    });

    expect(result.success).toBe(true);
  });

  it("rejects non-HTTP URLs", () => {
    const result = SearchResultSchema.safeParse({
      title: "Example",
      url: "ftp://example.com",
      snippet: "Example result.",
      source: "Example",
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = SearchResultSchema.safeParse({
      title: "Example",
      url: "https://example.com",
    });

    expect(result.success).toBe(false);
  });
});

describe("SearchResponseSchema", () => {
  it("accepts a valid search response", () => {
    const result = SearchResponseSchema.safeParse({
      query: "Neon pricing",
      provider: "searxng",
      searchedAt: "2026-11-10T12:00:00.000Z",
      results: [
        {
          title: "Neon Pricing",
          url: "https://neon.com/pricing",
          snippet: "Pricing information.",
          source: "Neon",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects more than 20 results", () => {
    const results = Array.from(
      { length: 21 },
      (_, index) => ({
        title: `Result ${index}`,
        url: `https://example.com/${index}`,
        snippet: "Example.",
        source: "Example",
      })
    );

    const result = SearchResponseSchema.safeParse({
      query: "Example",
      provider: "searxng",
      searchedAt: "2026-11-10T12:00:00.000Z",
      results,
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid timestamps", () => {
    const result = SearchResponseSchema.safeParse({
      query: "Example",
      provider: "searxng",
      searchedAt: "not-a-date",
      results: [],
    });

    expect(result.success).toBe(false);
  });
});