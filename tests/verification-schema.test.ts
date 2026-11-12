import { describe, expect, it } from "vitest";

import {
  parseVerificationRequest,
  parseVerificationFinding,
  parseVerificationResult,
  parseComparisonResult,
} from "../src/agent/verification-schema.js";

const timestamp = "2026-11-12T10:00:00.000Z";

describe("Temporal verification domain contracts", () => {
  describe("VerificationRequest", () => {
    it("accepts a valid request", () => {
      const result = parseVerificationRequest({
        historicalSnapshotId: "snapshot-old",
        conversationId: "conversation-1",
        question: "Is this information still accurate?",
      });

      expect(result.historicalSnapshotId).toBe("snapshot-old");
    });

    it("accepts a request without optional fields", () => {
      const result = parseVerificationRequest({
        historicalSnapshotId: "snapshot-old",
      });

      expect(result.conversationId).toBeUndefined();
    });

    it("rejects an empty snapshot ID", () => {
      expect(() =>
        parseVerificationRequest({
          historicalSnapshotId: " ",
        })
      ).toThrow();
    });

    it("rejects unknown properties", () => {
      expect(() =>
        parseVerificationRequest({
          historicalSnapshotId: "snapshot-old",
          unexpected: true,
        })
      ).toThrow();
    });
  });

  describe("VerificationFinding", () => {
    const baseFinding = {
      id: "finding-1",
      claim: "The service supports TypeScript.",
      explanation: "Current documentation confirms this claim.",
      historicalEvidenceIds: ["historical-evidence-1"],
      currentEvidenceIds: ["current-evidence-1"],
    };

    it("accepts an unchanged finding", () => {
      const result = parseVerificationFinding({
        ...baseFinding,
        status: "unchanged",
      });

      expect(result.status).toBe("unchanged");
    });

    it("accepts a changed finding", () => {
      const result = parseVerificationFinding({
        ...baseFinding,
        status: "changed",
      });

      expect(result.status).toBe("changed");
    });

    it("accepts an unsupported finding without current evidence", () => {
      const result = parseVerificationFinding({
        ...baseFinding,
        status: "unsupported",
        currentEvidenceIds: [],
      });

      expect(result.status).toBe("unsupported");
    });

    it("accepts an inconclusive finding", () => {
      const result = parseVerificationFinding({
        ...baseFinding,
        status: "inconclusive",
      });

      expect(result.status).toBe("inconclusive");
    });

    it("rejects an unchanged finding without current evidence", () => {
      expect(() =>
        parseVerificationFinding({
          ...baseFinding,
          status: "unchanged",
          currentEvidenceIds: [],
        })
      ).toThrow("An unchanged finding must reference current evidence.");
    });

    it("rejects a changed finding without historical evidence", () => {
      expect(() =>
        parseVerificationFinding({
          ...baseFinding,
          status: "changed",
          historicalEvidenceIds: [],
        })
      ).toThrow();
    });

    it("rejects an unsupported finding with current evidence", () => {
      expect(() =>
        parseVerificationFinding({
          ...baseFinding,
          status: "unsupported",
        })
      ).toThrow(
        "An unsupported finding must not claim current evidence support."
      );
    });

    it("rejects an unknown verification status", () => {
      expect(() =>
        parseVerificationFinding({
          ...baseFinding,
          status: "verified",
        })
      ).toThrow();
    });

    it("rejects empty claims", () => {
      expect(() =>
        parseVerificationFinding({
          ...baseFinding,
          claim: " ",
          status: "inconclusive",
        })
      ).toThrow();
    });
  });

  describe("VerificationResult", () => {
    const unchangedFinding = {
      id: "finding-1",
      claim: "The service supports TypeScript.",
      status: "unchanged",
      explanation: "Current evidence confirms the historical finding.",
      historicalEvidenceIds: ["historical-evidence-1"],
      currentEvidenceIds: ["current-evidence-1"],
    };

    const baseResult = {
      id: "verification-1",
      historicalSnapshotId: "snapshot-old",
      currentSnapshotId: "snapshot-new",
      conversationId: "conversation-1",
      query: "TypeScript support",
      verifiedAt: timestamp,
    };

    it("accepts an unchanged verification result", () => {
      const result = parseVerificationResult({
        ...baseResult,
        status: "unchanged",
        findings: [unchangedFinding],
      });

      expect(result.findings).toHaveLength(1);
    });

    it("accepts a changed verification result", () => {
      const result = parseVerificationResult({
        ...baseResult,
        status: "changed",
        findings: [
          {
            ...unchangedFinding,
            status: "changed",
            explanation: "The current evidence describes a changed feature.",
          },
        ],
      });

      expect(result.status).toBe("changed");
    });

    it("accepts an inconclusive result", () => {
      const result = parseVerificationResult({
        ...baseResult,
        status: "inconclusive",
        findings: [
          {
            ...unchangedFinding,
            status: "inconclusive",
          },
        ],
      });

      expect(result.status).toBe("inconclusive");
    });

    it("accepts an unsupported result", () => {
      const result = parseVerificationResult({
        ...baseResult,
        status: "unsupported",
        findings: [
          {
            ...unchangedFinding,
            status: "unsupported",
            currentEvidenceIds: [],
          },
        ],
      });

      expect(result.status).toBe("unsupported");
    });

    it("rejects an unchanged result containing a changed finding", () => {
      expect(() =>
        parseVerificationResult({
          ...baseResult,
          status: "unchanged",
          findings: [
            {
              ...unchangedFinding,
              status: "changed",
            },
          ],
        })
      ).toThrow(
        "An unchanged result can only contain unchanged findings."
      );
    });

    it("rejects a changed result without changed findings", () => {
      expect(() =>
        parseVerificationResult({
          ...baseResult,
          status: "changed",
          findings: [unchangedFinding],
        })
      ).toThrow(
        "A changed result must contain at least one changed finding."
      );
    });

    it("rejects an invalid verification timestamp", () => {
      expect(() =>
        parseVerificationResult({
          ...baseResult,
          status: "unchanged",
          findings: [unchangedFinding],
          verifiedAt: "not-a-date",
        })
      ).toThrow();
    });

    it("accepts a result without optional snapshot and conversation IDs", () => {
      const result = parseVerificationResult({
        id: "verification-2",
        historicalSnapshotId: "snapshot-old",
        query: "TypeScript support",
        status: "inconclusive",
        findings: [],
        verifiedAt: timestamp,
      });

      expect(result.currentSnapshotId).toBeUndefined();
    });

    it("rejects unknown properties", () => {
      expect(() =>
        parseVerificationResult({
          ...baseResult,
          status: "inconclusive",
          findings: [],
          unexpected: true,
        })
      ).toThrow();
    });
  });

  describe("ComparisonResult", () => {
    const baseComparison = {
      id: "comparison-1",
      historicalSnapshotId: "snapshot-old",
      currentSnapshotId: "snapshot-new",
      historicalEvidenceIds: ["historical-evidence-1"],
      currentEvidenceIds: ["current-evidence-1"],
      explanation: "The historical and current evidence are consistent.",
      comparedAt: timestamp,
    };

    it("accepts an unchanged comparison", () => {
      const result = parseComparisonResult({
        ...baseComparison,
        status: "unchanged",
      });

      expect(result.status).toBe("unchanged");
    });

    it("accepts a changed comparison", () => {
      const result = parseComparisonResult({
        ...baseComparison,
        status: "changed",
        explanation: "The evidence describes different information.",
      });

      expect(result.status).toBe("changed");
    });

    it("accepts historical-only evidence", () => {
      const result = parseComparisonResult({
        ...baseComparison,
        status: "historical_only",
        currentEvidenceIds: [],
      });

      expect(result.status).toBe("historical_only");
    });

    it("accepts current-only evidence", () => {
      const result = parseComparisonResult({
        ...baseComparison,
        status: "current_only",
        historicalEvidenceIds: [],
      });

      expect(result.status).toBe("current_only");
    });

    it("accepts an inconclusive comparison", () => {
      const result = parseComparisonResult({
        ...baseComparison,
        status: "inconclusive",
      });

      expect(result.status).toBe("inconclusive");
    });

    it("rejects an empty snapshot ID", () => {
      expect(() =>
        parseComparisonResult({
          ...baseComparison,
          currentSnapshotId: " ",
          status: "inconclusive",
        })
      ).toThrow();
    });

    it("rejects an invalid comparison timestamp", () => {
      expect(() =>
        parseComparisonResult({
          ...baseComparison,
          status: "unchanged",
          comparedAt: "invalid",
        })
      ).toThrow();
    });

    it("rejects unknown properties", () => {
      expect(() =>
        parseComparisonResult({
          ...baseComparison,
          status: "unchanged",
          unexpected: true,
        })
      ).toThrow();
    });
  });
});