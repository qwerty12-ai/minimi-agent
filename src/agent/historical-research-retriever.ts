import type {
  ResearchSnapshot,
  ResearchSnapshotRepository,
} from "../memory/types.js";

import { parseResearchSnapshot } from "../memory/memory-schema.js";
import { parseVerificationRequest } from "./verification-schema.js";

export class HistoricalResearchNotFoundError extends Error {
  constructor(snapshotId: string) {
    super(`Historical research snapshot '${snapshotId}' was not found.`);
    this.name = "HistoricalResearchNotFoundError";
  }
}

export class HistoricalResearchOwnershipError extends Error {
  constructor(snapshotId: string, conversationId: string) {
    super(
      `Historical research snapshot '${snapshotId}' does not belong to conversation '${conversationId}'.`,
    );
    this.name = "HistoricalResearchOwnershipError";
  }
}

function normalizeSnapshot(value: unknown): ResearchSnapshot {
  const parsed = parseResearchSnapshot(value);

  return {
    id: parsed.id,
    ...(parsed.conversationId !== undefined
      ? { conversationId: parsed.conversationId }
      : {}),
    query: parsed.query,
    provider: parsed.provider,
    searchedAt: parsed.searchedAt,
    recordedAt: parsed.recordedAt,
    results: parsed.results.map((result) => ({
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      source: result.source,
      ...(result.publishedAt !== undefined
        ? { publishedAt: result.publishedAt }
        : {}),
      ...(result.score !== undefined
        ? { score: result.score }
        : {}),
    })),
  };
}

export class HistoricalResearchRetriever {
  constructor(
    private readonly repository: ResearchSnapshotRepository,
  ) {}

  async retrieve(request: unknown): Promise<ResearchSnapshot> {
    const validatedRequest = parseVerificationRequest(request);

    const snapshot = await this.repository.findById(
      validatedRequest.historicalSnapshotId,
    );

    if (!snapshot) {
      throw new HistoricalResearchNotFoundError(
        validatedRequest.historicalSnapshotId,
      );
    }

    const validatedSnapshot = normalizeSnapshot(snapshot);

    if (
      validatedRequest.conversationId !== undefined &&
      validatedSnapshot.conversationId !== validatedRequest.conversationId
    ) {
      throw new HistoricalResearchOwnershipError(
        validatedRequest.historicalSnapshotId,
        validatedRequest.conversationId,
      );
    }

    return validatedSnapshot;
  }

  async retrieveConversationHistory(
    conversationId: string,
  ): Promise<ResearchSnapshot[]> {
    const snapshots = await this.repository.findByConversation(
      conversationId,
    );

    return snapshots
      .map((snapshot) => normalizeSnapshot(snapshot))
      .sort((a, b) => {
        const timeDifference =
          Date.parse(a.recordedAt) - Date.parse(b.recordedAt);

        return timeDifference !== 0
          ? timeDifference
          : a.id.localeCompare(b.id);
      });
  }
}