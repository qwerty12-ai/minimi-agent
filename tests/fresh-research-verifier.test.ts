import { describe, expect, it, vi } from "vitest";

import {
  FreshResearchVerificationError,
  FreshResearchVerifier,
} from "../src/agent/fresh-research-verifier.js";

import type { ResearchSnapshot } from "../src/memory/types.js";
import type { ResearchContext } from "../src/agent/orchestration-types.js";

import type { HistoricalResearchRetriever } from "../src/agent/historical-research-retriever.js";
import type { ResearchExecutor } from "../src/agent/research-executor.js";

const historical: ResearchSnapshot = {
  id: "snapshot-old",
  conversationId: "conversation-1",
  query: "TypeScript documentation",
  provider: "searxng",
  searchedAt: "2026-11-10T10:00:00.000Z",
  recordedAt: "2026-11-10T10:01:00.000Z",
  results: [
    {
      title: "TypeScript Handbook",
      url: "https://www.typescriptlang.org/docs/",
      snippet: "Official TypeScript documentation.",
      source: "TypeScript",
    },
  ],
};

const current: ResearchContext = {
  query: "TypeScript documentation",
  provider: "searxng",
  searchedAt: "2026-11-12T10:00:00.000Z",
  results: [
    {
      title: "TypeScript Documentation",
      url: "https://www.typescriptlang.org/docs/",
      snippet: "Current TypeScript documentation.",
      source: "TypeScript",
    },
  ],
};

function createDependencies() {
  const historicalRetriever = {
    retrieve: vi.fn().mockResolvedValue(historical),
  };

  const researchExecutor = {
    execute: vi.fn().mockResolvedValue(current),
  };

  const verifier = new FreshResearchVerifier(
    historicalRetriever as unknown as HistoricalResearchRetriever,
    researchExecutor as unknown as ResearchExecutor,
  );

  return {
    verifier,
    historicalRetriever,
    researchExecutor,
  };
}

describe("FreshResearchVerifier", () => {
  it("retrieves historical research and executes fresh research", async () => {
    const {
      verifier,
      historicalRetriever,
      researchExecutor,
    } = createDependencies();

    const request = {
      historicalSnapshotId: "snapshot-old",
      conversationId: "conversation-1",
    };

    const result = await verifier.verify(request);

    expect(historicalRetriever.retrieve).toHaveBeenCalledWith(request);

    expect(researchExecutor.execute).toHaveBeenCalledWith(
      "TypeScript documentation",
      {
        intent: "VERIFY",
        requiresMemory: false,
        requiresSearch: true,
      },
    );

    expect(result).toEqual({
      historical,
      current,
    });
  });

  it("uses the historical query for fresh research", async () => {
    const {
      verifier,
      researchExecutor,
    } = createDependencies();

    await verifier.verify({
      historicalSnapshotId: "snapshot-old",
    });

    expect(researchExecutor.execute).toHaveBeenCalledWith(
      historical.query,
      expect.any(Object),
    );
  });

  it("rejects when historical research retrieval fails", async () => {
    const {
      verifier,
      historicalRetriever,
      researchExecutor,
    } = createDependencies();

    historicalRetriever.retrieve.mockRejectedValue(
      new Error("Snapshot not found."),
    );

    await expect(
      verifier.verify({
        historicalSnapshotId: "missing",
      }),
    ).rejects.toBeInstanceOf(FreshResearchVerificationError);

    expect(researchExecutor.execute).not.toHaveBeenCalled();
  });

  it("rejects when fresh research execution fails", async () => {
    const {
      verifier,
      researchExecutor,
    } = createDependencies();

    researchExecutor.execute.mockRejectedValue(
      new Error("Search provider unavailable."),
    );

    await expect(
      verifier.verify({
        historicalSnapshotId: "snapshot-old",
      }),
    ).rejects.toThrow("Failed to execute fresh research.");
  });

  it("rejects when fresh research returns no context", async () => {
    const {
      verifier,
      researchExecutor,
    } = createDependencies();

    researchExecutor.execute.mockResolvedValue(null);

    await expect(
      verifier.verify({
        historicalSnapshotId: "snapshot-old",
      }),
    ).rejects.toThrow(
      "Fresh research did not produce a research context.",
    );
  });
});