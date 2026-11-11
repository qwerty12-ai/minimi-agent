import { describe, expect, it, vi } from "vitest";

import {
  SearchService,
} from "../src/research/search-service.js";

import {
  SearXNGProvider,
} from "../src/research/searxng-provider.js";

describe("Search infrastructure integration", () => {
  it("executes and normalizes a complete search", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              title: "  TypeScript   Architecture ",
              url: "https://example.com/architecture#overview",
              content: "  Architecture   and   design ",
              engine: "google",
              score: 4.5,
            },
            {
              title: "Duplicate result",
              url: "https://example.com/architecture#details",
              content: "Duplicate content",
              engine: "bing",
            },
            {
              title: "Second result",
              url: "https://example.com/typescript",
              content: "TypeScript information",
              engine: "duckduckgo",
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

    const service = new SearchService(provider);

    const response = await service.search({
      query: "TypeScript architecture",
      maxResults: 2,
    });

    expect(response.provider).toBe("searxng");
    expect(response.query).toBe("TypeScript architecture");
    expect(response.results).toHaveLength(2);

    expect(response.results[0]).toMatchObject({
      title: "TypeScript Architecture",
      url: "https://example.com/architecture",
      snippet: "Architecture and design",
      source: "google",
      score: 4.5,
    });

    expect(response.results[1].url)
      .toBe("https://example.com/typescript");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propagates SearXNG HTTP failures through SearchService", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Unavailable", { status: 503 })
    );

    const provider = new SearXNGProvider({
      baseUrl: "http://localhost:8080",
      fetchImpl: fetchMock,
    });

    const service = new SearchService(provider);

    await expect(
      service.search({ query: "Testing" })
    ).rejects.toThrow("SearXNG returned HTTP 503.");
  });

  it("propagates malformed JSON errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("invalid-json", { status: 200 })
    );

    const provider = new SearXNGProvider({
      baseUrl: "http://localhost:8080",
      fetchImpl: fetchMock,
    });

    const service = new SearchService(provider);

    await expect(
      service.search({ query: "Testing" })
    ).rejects.toThrow("SearXNG returned invalid JSON.");
  });

  it("rejects invalid search requests before contacting SearXNG", async () => {
    const fetchMock = vi.fn();

    const provider = new SearXNGProvider({
      baseUrl: "http://localhost:8080",
      fetchImpl: fetchMock,
    });

    const service = new SearchService(provider);

    await expect(
      service.search({ query: "   " })
    ).rejects.toThrow();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("handles search provider timeouts", async () => {
    const fetchMock = vi.fn().mockImplementation(
      (_url: URL, options: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          options.signal?.addEventListener(
            "abort",
            () => {
              const error = new Error("Aborted");
              error.name = "AbortError";
              reject(error);
            },
            { once: true }
          );
        })
    );

    const provider = new SearXNGProvider({
      baseUrl: "http://localhost:8080",
      timeoutMs: 10,
      fetchImpl: fetchMock,
    });

    const service = new SearchService(provider);

    await expect(
      service.search({ query: "Testing" })
    ).rejects.toThrow("SearXNG request timed out.");
  });
});