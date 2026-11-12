import { z } from "zod";

export const VerificationStatusSchema = z.enum([
  "unchanged",
  "changed",
  "unsupported",
  "inconclusive",
]);

export const ComparisonStatusSchema = z.enum([
  "unchanged",
  "changed",
  "historical_only",
  "current_only",
  "inconclusive",
]);

export const VerificationRequestSchema = z.object({
  historicalSnapshotId: z.string().trim().min(1).max(200),
  conversationId: z.string().trim().min(1).max(200).optional(),
  question: z.string().trim().min(1).max(100000).optional(),
}).strict();

export const VerificationFindingSchema = z.object({
  id: z.string().trim().min(1).max(200),
  claim: z.string().trim().min(1).max(10000),
  status: VerificationStatusSchema,
  explanation: z.string().trim().min(1).max(10000),
  historicalEvidenceIds: z.array(
    z.string().trim().min(1).max(200)
  ).max(500),
  currentEvidenceIds: z.array(
    z.string().trim().min(1).max(200)
  ).max(500),
}).strict().superRefine((finding, context) => {
  if (
    finding.status === "unchanged" &&
    finding.currentEvidenceIds.length === 0
  ) {
    context.addIssue({
      code: "custom",
      path: ["currentEvidenceIds"],
      message: "An unchanged finding must reference current evidence.",
    });
  }

  if (
    finding.status === "changed" &&
    (
      finding.historicalEvidenceIds.length === 0 ||
      finding.currentEvidenceIds.length === 0
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["currentEvidenceIds"],
      message: "A changed finding must reference historical and current evidence.",
    });
  }

  if (
    finding.status === "unsupported" &&
    finding.currentEvidenceIds.length > 0
  ) {
    context.addIssue({
      code: "custom",
      path: ["currentEvidenceIds"],
      message: "An unsupported finding must not claim current evidence support.",
    });
  }
});

export const VerificationResultSchema = z.object({
  id: z.string().trim().min(1).max(200),
  historicalSnapshotId: z.string().trim().min(1).max(200),
  currentSnapshotId: z.string().trim().min(1).max(200).optional(),
  conversationId: z.string().trim().min(1).max(200).optional(),
  query: z.string().trim().min(1).max(500),
  status: VerificationStatusSchema,
  findings: z.array(VerificationFindingSchema).max(500),
  verifiedAt: z.string().datetime(),
}).strict().superRefine((result, context) => {
  if (
    result.status === "unchanged" &&
    result.findings.some((finding) => finding.status !== "unchanged")
  ) {
    context.addIssue({
      code: "custom",
      path: ["status"],
      message: "An unchanged result can only contain unchanged findings.",
    });
  }

  if (
    result.status === "changed" &&
    !result.findings.some((finding) => finding.status === "changed")
  ) {
    context.addIssue({
      code: "custom",
      path: ["status"],
      message: "A changed result must contain at least one changed finding.",
    });
  }
});

export const ComparisonResultSchema = z.object({
  id: z.string().trim().min(1).max(200),
  historicalSnapshotId: z.string().trim().min(1).max(200),
  currentSnapshotId: z.string().trim().min(1).max(200),
  status: ComparisonStatusSchema,
  historicalEvidenceIds: z.array(
    z.string().trim().min(1).max(200)
  ).max(500),
  currentEvidenceIds: z.array(
    z.string().trim().min(1).max(200)
  ).max(500),
  explanation: z.string().trim().min(1).max(10000),
  comparedAt: z.string().datetime(),
}).strict();

export function parseVerificationRequest(value: unknown) {
  return VerificationRequestSchema.parse(value);
}

export function parseVerificationFinding(value: unknown) {
  return VerificationFindingSchema.parse(value);
}

export function parseVerificationResult(value: unknown) {
  return VerificationResultSchema.parse(value);
}

export function parseComparisonResult(value: unknown) {
  return ComparisonResultSchema.parse(value);
}