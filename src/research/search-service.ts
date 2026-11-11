import type {
    SearchProvider,
    SearchRequest,
    SearchResponse,
    SearchResult
} from "./types.js";

import {
    parseSearchRequest,
    parseSearchResponse
} from "./search-schema.js";

export class SearchProviderError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SearchProviderError";
    }
}

function normalizeResult(result: SearchResult): SearchResult {
    const normalizedUrl = new URL(result.url);
    normalizedUrl.hash="";
    const cleanText = (value: string): string => value.replace(/[\s\u00A0]+/g, " ").trim()
    return {
        ...result,
        title: cleanText(result.title),
        url: normalizedUrl.toString(),
        snippet: cleanText(result.snippet),
        source: cleanText(result.source)
    }
}

function normalizeResults(results: SearchResult[], maxResults: number): SearchResult[] {
    const seenUrls = new Set<string>();
    const normalizedResults: SearchResult[] = [];

    for (const result of results) {
        const normalized = normalizeResult(result);

        const canonicalUrl = normalized.url;

        if (seenUrls.has(canonicalUrl)) {
            continue;
        }

        seenUrls.add(canonicalUrl);
        normalizedResults.push(normalized);

        if(normalizedResults.length >= maxResults) {
            break;
        }
    }

    return normalizedResults;
} 

export class SearchService {
  constructor(
    private readonly provider: SearchProvider
  ) {}

  async search(
    request: SearchRequest
  ): Promise<SearchResponse> {
    const validatedRequest = parseSearchRequest(request);

    let rawResponse: unknown;

    try {
      rawResponse = await this.provider.search(validatedRequest);
    } catch (error) {
      throw new SearchProviderError(
        error instanceof Error
          ? error.message
          : "Search provider failed."
      );
    }

    let response: SearchResponse;

    try {
      response = parseSearchResponse(rawResponse);
    } catch {
      throw new SearchProviderError(
        "Search provider returned an invalid response."
      );
    }

    if (response.provider !== this.provider.name) {
      throw new SearchProviderError(
        "Search provider identity mismatch."
      );
    }

    if (response.query !== validatedRequest.query) {
      throw new SearchProviderError(
        "Search provider returned results for a different query."
      );
    }

    const results = normalizeResults(
      response.results,
      validatedRequest.maxResults ?? 10
    );

    return {
      ...response,
      results,
    };
  }
}