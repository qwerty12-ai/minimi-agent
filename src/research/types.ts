export type SearchTimeRange = "day" | "week" | "month" | "year";

export interface SearchRequest {
    query: string;
    maxResults?: number | undefined;
    region?: string | undefined;
    timeRange?: SearchTimeRange | undefined
}

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    source: string;
    publishedAt?: string | undefined;
    score?: number | undefined;
}

export interface SearchResponse {
    query: string;
    provider: string;
    searchedAt: string;
    results: SearchResult[];
}

export interface SearchProvider {
    readonly name: string;
    search(request: SearchRequest): Promise<SearchResponse>;
}