import type { ResearchSnapshot } from "../memory/types.js";
import type { ResearchContext } from "./orchestration-types.js";
import type { ExecutionPlan } from "./types.js";

import {
  HistoricalResearchRetriever,
} from "./historical-research-retriever.js";

import {
  ResearchExecutor,
} from "./research-executor.js";

export interface FreshResearchVerification {
  historical: ResearchSnapshot;
  current: ResearchContext;
}

export class FreshResearchVerificationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "FreshResearchVerificationError";
  }
}

export class FreshResearchVerifier {
  constructor(
    private readonly historicalRetriever: HistoricalResearchRetriever,
    private readonly researchExecutor: ResearchExecutor,
  ) {}

  async verify(
    request: unknown,
  ): Promise<FreshResearchVerification> {
    let historical: ResearchSnapshot;

    try {
      historical = await this.historicalRetriever.retrieve(request);
    } catch (error) {
      throw new FreshResearchVerificationError(
        "Failed to retrieve historical research.",
        { cause: error },
      );
    }

    const plan: ExecutionPlan = {
      intent: "VERIFY",
      requiresMemory: false,
      requiresSearch: true,
    };

    let current: ResearchContext | null;

    try {
      current = await this.researchExecutor.execute(
        historical.query,
        plan,
      );
    } catch (error) {
      throw new FreshResearchVerificationError(
        "Failed to execute fresh research.",
        { cause: error },
      );
    }

    if (!current) {
      throw new FreshResearchVerificationError(
        "Fresh research did not produce a research context.",
      );
    }

    return {
      historical,
      current,
    };
  }
}