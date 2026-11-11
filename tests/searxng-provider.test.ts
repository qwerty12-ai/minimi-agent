import { describe, expect, it, vi } from "vitest";

import {
  SearXNGProvider,
  SearXNGProviderError,
} from "../src/research/searxng-provider.js";

describe("SearXNGProvider", () => {
  it("creates a provider with the correct identity", () => {
    const provider = new SearXNGProvider({
      baseUrl: "http://localhost:8080",
    });

    expect(provider.name).toBe("searxng");
  });

  it("rejects invalid URL protocols", () => {
    expect(
      () =>
        new SearXNGProvider({
          baseUrl: "ftp://localhost:8080",
        })
    ).toThrow(SearXNGProviderError);
  });

  it("rejects invalid timeout values", () => {
    expect(
      () =>
        new SearXNGProvider({
          baseUrl: "http://localhost:8080",
          timeoutMs: 0,
        })
    ).toThrow(SearXNGProviderError);
  });

  it("sends the correct search parameters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ results: [] }),
        { status: 200 }
      )
    );

    const provider = new SearXNGProvider({
      baseUrl: "http://localhost:8080",
      fetchImpl: fetchMock,
    });

    await provider.search({
      query: "TypeScript architecture",
      region: "en-US",
      timeRange: "week",
    });

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);

    expect(calledUrl.pathname).toBe("/search");
    expect(calledUrl.searchParams.get("q"))
      .toBe("TypeScript architecture");
    expect(calledUrl.searchParams.get("format"))
      .toBe("json");
    expect(calledUrl.searchParams.get("language"))
      .toBe("en-US");
    expect(calledUrl.searchParams.get("time_range"))
      .toBe("week");
  });

  it("normalizes SearXNG results", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              title: "TypeScript Guide",
              url: "https://example.com/typescript",
              content: "A TypeScript guide.",
              engine: "google",
              publishedDate: "2026-11-10T10:00:00.000Z",
              score: 4.5,
            },
          ],
        }),
        { status: 200 }
      )
    );

    const provider = new SearXNGProvider({
      baseUrl: "http://localhost:8080",
      fetchImpl: fetchMock,
    });

    const result = await provider.search({
      query: "TypeScript",
    });

    expect(result.provider).toBe("searxng");
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      title: "TypeScript Guide",
      source: "google",
      snippet: "A TypeScript guide.",
      score: 4.5,
    });
  });

  it("maps all valid results without applying the final result limit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: Array.from(
            { length: 5 },
            (_, index) => ({
              title: `Result ${index}`,
              url: `https://example.com/${index}`,
            })
          ),
        }),
        { status: 200 }
      )
    );

    const provider = new SearXNGProvider({
      baseUrl: "http://localhost:8080",
      fetchImpl: fetchMock,
    });

    const result = await provider.search({
      query: "Testing",
      maxResults: 2,
    });

    expect(result.results).toHaveLength(5);
  });

  it("rejects unsuccessful HTTP responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Unavailable", { status: 503 })
    );

    const provider = new SearXNGProvider({
      baseUrl: "http://localhost:8080",
      fetchImpl: fetchMock,
    });

    await expect(
      provider.search({ query: "Testing" })
    ).rejects.toThrow("SearXNG returned HTTP 503.");
  });

  it("rejects malformed JSON responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("not-json", { status: 200 })
    );

    const provider = new SearXNGProvider({
      baseUrl: "http://localhost:8080",
      fetchImpl: fetchMock,
    });

    await expect(
      provider.search({ query: "Testing" })
    ).rejects.toThrow("SearXNG returned invalid JSON.");
  });

  it("rejects responses without a results array", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ unexpected: [] }),
        { status: 200 }
      )
    );

    const provider = new SearXNGProvider({
      baseUrl: "http://localhost:8080",
      fetchImpl: fetchMock,
    });

    await expect(
      provider.search({ query: "Testing" })
    ).rejects.toThrow("SearXNG response did not contain a results array.");
  });
});