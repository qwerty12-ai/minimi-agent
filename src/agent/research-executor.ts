import type { SearchService } from "../research/search-service.js";
import type { ExecutionPlan } from "./types.js";
import type { ResearchContext } from "./orchestration-types.js";

import { parseResearchContext } from "./orchestration-schema.js";

export class ResearchExecutionError extends Error {
  readonly stage = "research" as const;
  readonly code = "RESEARCH_FAILED" as const;
  readonly retryable = true;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ResearchExecutionError";
  }
}

export class ResearchExecutor {
  constructor(
    private readonly searchService: Pick<SearchService, "search">,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(
    query: string,
    plan: ExecutionPlan,
    maxResults = 10,
  ): Promise<ResearchContext | null> {
    const normalizedQuery = query.trim();

    if (
      normalizedQuery.length === 0 ||
      normalizedQuery.length > 500
    ) {
      throw new Error(
        "Research query must contain between 1 and 500 characters.",
      );
    }

    if (
      !Number.isInteger(maxResults) ||
      maxResults < 1 ||
      maxResults > 20
    ) {
      throw new Error(
        "Research result limit must be between 1 and 20.",
      );
    }

    if (!plan.requiresSearch) {
      return null;
    }

    let response;

    try {
      response = await this.searchService.search({
        query: normalizedQuery,
        maxResults,
      });
    } catch (error) {
      throw new ResearchExecutionError(
        error instanceof Error
          ? error.message
          : "Research execution failed.",
        { cause: error },
      );
    }

    try {
      const context: ResearchContext = {
        query: normalizedQuery,
        provider: response.provider,
        searchedAt: response.searchedAt,
        results: response.results,
      };

      parseResearchContext(context);

      return context;
    } catch (error) {
      throw new ResearchExecutionError(
        "Search service returned invalid research context.",
        { cause: error },
      );
    }
  }
}