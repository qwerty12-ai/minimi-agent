import type { SearchProvider, SearchRequest, SearchResponse, SearchResult } from "./types.js";

interface SearXNGResult {
    title?: unknown;
    url?: unknown;
    content?: unknown;
    engine?: unknown;
    publishedDate?: unknown;
    score?: unknown;
}

interface SearXNGResponse {
    results?: unknown;
}

export interface SearXNGProviderConfig {
    baseUrl?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch
}

export class SearXNGProviderError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SearXNGProvideError";
    }
}

export class SearXNGProvider implements SearchProvider {
    readonly name = "searxng";

    private readonly baseUrl: string;
    private readonly timeoutMs: number;
    private readonly fetchImpl: typeof fetch;

    constructor(config: SearXNGProviderConfig) {
        if (
            typeof config.baseUrl !== "string" ||
            config.baseUrl.trim().length === 0
        ) {
            throw new SearXNGProviderError(
                "SearXNG base URL is required."
            );
        }

        this.baseUrl = config.baseUrl.trim().replace(/\/+$/, "");
        this.timeoutMs = config.timeoutMs ?? 10000;
        this.fetchImpl = config.fetchImpl ?? fetch;

        let parsedUrl: URL;

        try {
            parsedUrl = new URL(this.baseUrl);
        } catch {
            throw new SearXNGProviderError(
                "SearXNG base URL is invalid."
            );
        }

        if (
            parsedUrl.protocol !== "http:" &&
            parsedUrl.protocol !== "https:"
        ) {
            throw new SearXNGProviderError(
                "SearXNG URL must use HTTP or HTTPS."
            );
        }

        if (this.timeoutMs <= 0) {
            throw new SearXNGProviderError(
                "Timeout must be greater than zero."
            );
        }
    }

    async search(
        request: SearchRequest
    ): Promise<SearchResponse> {
        const url = new URL(`${this.baseUrl}/search`);

        url.searchParams.set("q", request.query);
        url.searchParams.set("format", "json");

        if (request.region) {
            url.searchParams.set("language", request.region);
        }

        if (request.timeRange) {
            url.searchParams.set("time_range", request.timeRange);
        }

        const controller = new AbortController();

        const timeout = setTimeout(
            () => controller.abort(),
            this.timeoutMs
        );

        try {
            const response = await this.fetchImpl(url, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                },
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new SearXNGProviderError(
                    `SearXNG returned HTTP ${response.status}.`
                );
            }

            let data: SearXNGResponse;

            try {
                data = await response.json() as SearXNGResponse;
            } catch {
                throw new SearXNGProviderError(
                    "SearXNG returned invalid JSON."
                );
            }

            if (!Array.isArray(data.results)) {
                throw new SearXNGProviderError(
                    "SearXNG response did not contain a results array."
                );
            }

            const results: SearchResult[] = data.results
                .filter((item): item is SearXNGResult => {
                    return (
                        typeof item === "object" &&
                        item !== null &&
                        typeof (item as SearXNGResult).title === "string" &&
                        typeof (item as SearXNGResult).url === "string"
                    );
                })
                .map((item) => ({
                    title: item.title as string,
                    url: item.url as string,
                    snippet:
                        typeof item.content === "string"
                            ? item.content
                            : "",
                    source:
                        typeof item.engine === "string"
                            ? item.engine
                            : "SearXNG",
                    ...(typeof item.publishedDate === "string"
                        ? { publishedAt: item.publishedDate }
                        : {}),
                    ...(typeof item.score === "number"
                        ? { score: item.score }
                        : {}),
                }));

            return {
                query: request.query,
                provider: this.name,
                searchedAt: new Date().toISOString(),
                results,
            };
        } catch (error) {
            if (error instanceof SearXNGProviderError) {
                throw error;
            }

            if (
                error instanceof Error &&
                error.name === "AbortError"
            ) {
                throw new SearXNGProviderError(
                    "SearXNG request timed out."
                );
            }

            throw new SearXNGProviderError(
                error instanceof Error
                    ? error.message
                    : "Unable to connect to SearXNG."
            );
        } finally {
            clearTimeout(timeout);
        }
    }
}