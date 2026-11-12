import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  openDatabase,
  type SQLiteDatabase,
} from "../src/database/sqlite.js";

import {
  SQLiteResearchSnapshotRepository,
} from "../src/memory/sqlite-repositories.js";

import {
  SQLiteVerificationRepository,
} from "../src/memory/sqlite-verification-repository.js";

import type { ResearchSnapshot } from "../src/memory/types.js";
import type {
  ComparisonResult,
  VerificationResult,
} from "../src/agent/verification-types.js";

describe("SQLiteVerificationRepository", () => {
  let database: SQLiteDatabase;
  let snapshots: SQLiteResearchSnapshotRepository;
  let verifications: SQLiteVerificationRepository;

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
        snippet: "Historical documentation.",
        source: "Example",
      },
    ],
  };

  const current: ResearchSnapshot = {
    id: "snapshot-current",
    query: "TypeScript documentation",
    provider: "searxng",
    searchedAt: "2026-11-12T10:00:00.000Z",
    recordedAt: "2026-11-12T10:01:00.000Z",
    results: [
      {
        title: "TypeScript Handbook",
        url: "https://example.com/docs",
        snippet: "Current documentation.",
        source: "Example",
      },
    ],
  };

  const verification: VerificationResult = {
    id: "verification-1",
    historicalSnapshotId: "snapshot-old",
    currentSnapshotId: "snapshot-current",
    query: "TypeScript documentation",
    status: "changed",
    findings: [
      {
        id: "finding-1",
        claim: "The documentation content changed.",
        status: "changed",
        explanation: "The current evidence has different content.",
        historicalEvidenceIds: ["evidence-old"],
        currentEvidenceIds: ["evidence-current"],
      },
    ],
    verifiedAt: "2026-11-12T10:02:00.000Z",
  };

  const comparison: ComparisonResult = {
    id: "comparison-1",
    historicalSnapshotId: "snapshot-old",
    currentSnapshotId: "snapshot-current",
    status: "changed",
    historicalEvidenceIds: ["evidence-old"],
    currentEvidenceIds: ["evidence-current"],
    explanation: "The evidence content changed.",
    comparedAt: "2026-11-12T10:03:00.000Z",
  };

  beforeEach(async () => {
    database = openDatabase(":memory:");
    snapshots = new SQLiteResearchSnapshotRepository(database);
    verifications = new SQLiteVerificationRepository(database);

    await snapshots.save(historical);
    await snapshots.save(current);
  });

  afterEach(() => {
    database.close();
  });

  it("saves and retrieves a verification result", async () => {
    await verifications.saveVerificationResult(verification);

    await expect(
      verifications.findVerificationResult("verification-1"),
    ).resolves.toEqual(verification);
  });

  it("returns null for a missing verification result", async () => {
    await expect(
      verifications.findVerificationResult("missing"),
    ).resolves.toBeNull();
  });

  it("preserves optional verification fields when absent", async () => {
    const result: VerificationResult = {
      id: "verification-minimal",
      historicalSnapshotId: "snapshot-old",
      query: "TypeScript documentation",
      status: "inconclusive",
      findings: [],
      verifiedAt: "2026-11-12T10:04:00.000Z",
    };

    await verifications.saveVerificationResult(result);

    await expect(
      verifications.findVerificationResult("verification-minimal"),
    ).resolves.toEqual(result);
  });

  it("rejects verification results referencing missing snapshots", async () => {
    const invalid: VerificationResult = {
      ...verification,
      id: "verification-invalid",
      historicalSnapshotId: "missing-snapshot",
    };

    await expect(
      verifications.saveVerificationResult(invalid),
    ).rejects.toThrow();

    await expect(
      verifications.findVerificationResult("verification-invalid"),
    ).resolves.toBeNull();
  });

  it("saves and retrieves a comparison result", async () => {
    await verifications.saveComparisonResult(comparison);

    await expect(
      verifications.findComparisonResults(
        "snapshot-old",
        "snapshot-current",
      ),
    ).resolves.toEqual([comparison]);
  });

  it("retrieves comparisons only for the requested snapshot pair", async () => {
    await verifications.saveComparisonResult(comparison);

    const otherComparison: ComparisonResult = {
      ...comparison,
      id: "comparison-2",
      status: "unchanged",
      explanation: "The evidence is unchanged.",
    };

    await verifications.saveComparisonResult(otherComparison);

    await expect(
      verifications.findComparisonResults(
        "snapshot-old",
        "snapshot-current",
      ),
    ).resolves.toHaveLength(2);

    await expect(
      verifications.findComparisonResults(
        "snapshot-current",
        "snapshot-old",
      ),
    ).resolves.toEqual([]);
  });

  it("returns an empty array when no comparisons exist", async () => {
    await expect(
      verifications.findComparisonResults(
        "snapshot-old",
        "snapshot-current",
      ),
    ).resolves.toEqual([]);
  });

  it("rejects invalid comparison results before persistence", async () => {
    const invalid: ComparisonResult = {
      ...comparison,
      id: "comparison-invalid",
      status: "changed",
      historicalEvidenceIds: [],
      currentEvidenceIds: [],
    };

    await expect(
      verifications.saveComparisonResult(invalid),
    ).rejects.toThrow();

    await expect(
      verifications.findComparisonResults(
        "snapshot-old",
        "snapshot-current",
      ),
    ).resolves.toEqual([]);
  });

  it("rejects comparisons referencing nonexistent snapshots", async () => {
    const invalid: ComparisonResult = {
      ...comparison,
      id: "comparison-missing-snapshot",
      currentSnapshotId: "missing-snapshot",
    };

    await expect(
      verifications.saveComparisonResult(invalid),
    ).rejects.toThrow();
  });
});