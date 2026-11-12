import { describe, expect, it } from "vitest";

import {
  EvidenceComparisonEngine,
} from "../src/agent/evidence-comparsion-engine.js";

import type { ResearchSnapshot } from "../src/memory/types.js";
import type { ComparisonResult } from "../src/agent/verification-types.js";

const historical: ResearchSnapshot = {
  id: "snapshot-old",
  query: "TypeScript documentation",
  provider: "searxng",
  searchedAt: "2026-11-10T10:00:00.000Z",
  recordedAt: "2026-11-10T10:01:00.000Z",
  results: [
    {
      title: "TypeScript Handbook",
      url: "https://example.com/docs",
      snippet: "Official documentation.",
      source: "Example",
    },
    {
      title: "Old Article",
      url: "https://example.com/old",
      snippet: "Historical article.",
      source: "Example",
    },
    {
      title: "Updated Article",
      url: "https://example.com/updated",
      snippet: "Original content.",
      source: "Example",
    },
  ],
};

const current: ResearchSnapshot = {
  id: "snapshot-new",
  query: "TypeScript documentation",
  provider: "searxng",
  searchedAt: "2026-11-12T10:00:00.000Z",
  recordedAt: "2026-11-12T10:01:00.000Z",
  results: [
    {
      title: "TypeScript Handbook",
      url: "https://example.com/docs#overview",
      snippet: "Official documentation.",
      source: "Example",
    },
    {
      title: "Updated Article",
      url: "https://example.com/updated",
      snippet: "Revised content.",
      source: "Example",
    },
    {
      title: "New Article",
      url: "https://example.com/new",
      snippet: "Recently published.",
      source: "Example",
    },
  ],
};

describe("EvidenceComparisonEngine", () => {
  const fixedDate = new Date("2026-11-12T12:00:00.000Z");

  function createEngine(): EvidenceComparisonEngine {
    return new EvidenceComparisonEngine(
      () => new Date(fixedDate),
    );
  }

  it("identifies unchanged evidence", () => {
    const results: ComparisonResult[] = createEngine().compare(
      historical,
      current,
    );

    const unchanged = results.find(
      (result: ComparisonResult) => result.status === "unchanged",
    );

    expect(unchanged).toBeDefined();
    expect(unchanged?.historicalEvidenceIds).toHaveLength(1);
    expect(unchanged?.currentEvidenceIds).toHaveLength(1);
  });

  it("ignores URL fragments when matching evidence", () => {
    const results: ComparisonResult[] = createEngine().compare(
      historical,
      current,
    );

    const unchanged = results.find(
      (result: ComparisonResult) => result.status === "unchanged",
    );

    expect(unchanged).toBeDefined();
  });

  it("identifies changed evidence with the same URL", () => {
    const results: ComparisonResult[] = createEngine().compare(
      historical,
      current,
    );

    const changed = results.find(
      (result: ComparisonResult) => result.status === "changed",
    );

    expect(changed).toBeDefined();
    expect(changed?.historicalEvidenceIds).toHaveLength(1);
    expect(changed?.currentEvidenceIds).toHaveLength(1);
  });

  it("identifies evidence found only in the historical snapshot", () => {
    const results: ComparisonResult[] = createEngine().compare(
      historical,
      current,
    );

    const historicalOnly = results.find(
      (result: ComparisonResult) => result.status === "historical_only",
    );

    expect(historicalOnly).toBeDefined();
    expect(historicalOnly?.historicalEvidenceIds).toHaveLength(1);
    expect(historicalOnly?.currentEvidenceIds).toHaveLength(0);
  });

  it("identifies evidence found only in the current snapshot", () => {
    const results: ComparisonResult[] = createEngine().compare(
      historical,
      current,
    );

    const currentOnly = results.find(
      (result: ComparisonResult) => result.status === "current_only",
    );

    expect(currentOnly).toBeDefined();
    expect(currentOnly?.historicalEvidenceIds).toHaveLength(0);
    expect(currentOnly?.currentEvidenceIds).toHaveLength(1);
  });

  it("returns no comparisons when both snapshots are empty", () => {
    const emptyHistorical: ResearchSnapshot = {
      ...historical,
      results: [],
    };

    const emptyCurrent: ResearchSnapshot = {
      ...current,
      results: [],
    };

    expect(
      createEngine().compare(emptyHistorical, emptyCurrent),
    ).toEqual([]);
  });

  it("returns inconclusive for invalid evidence URLs", () => {
    const invalidHistorical: ResearchSnapshot = {
      ...historical,
      results: [
        {
          title: "Invalid",
          url: "not-a-valid-url",
          snippet: "Content",
          source: "Example",
        },
      ],
    };

    const invalidCurrent: ResearchSnapshot = {
      ...current,
      results: [],
    };

    const results: ComparisonResult[] = createEngine().compare(
      invalidHistorical,
      invalidCurrent,
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("inconclusive");
  });

  it("rejects comparing a snapshot with itself", () => {
    expect(() =>
      createEngine().compare(historical, historical),
    ).toThrow(
      "Cannot compare a research snapshot with itself.",
    );
  });

  it("generates stable evidence identifiers", () => {
    const first: ComparisonResult[] = createEngine().compare(
      historical,
      current,
    );

    const second: ComparisonResult[] = createEngine().compare(
      historical,
      current,
    );

    expect(
      first.map((result: ComparisonResult) => [
        result.status,
        result.historicalEvidenceIds,
        result.currentEvidenceIds,
      ]),
    ).toEqual(
      second.map((result: ComparisonResult) => [
        result.status,
        result.historicalEvidenceIds,
        result.currentEvidenceIds,
      ]),
    );
  });

  it("uses the injected clock for comparison timestamps", () => {
    const results: ComparisonResult[] = createEngine().compare(
      historical,
      current,
    );

    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      expect(result.comparedAt).toBe(
        "2026-11-12T12:00:00.000Z",
      );
    }
  });
});