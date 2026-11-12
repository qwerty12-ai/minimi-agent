export type VerificationStatus =
  | "unchanged"
  | "changed"
  | "unsupported"
  | "inconclusive";

export type ComparisonStatus =
  | "unchanged"
  | "changed"
  | "historical_only"
  | "current_only"
  | "inconclusive";

export interface VerificationRequest {
  historicalSnapshotId: string;
  conversationId?: string;
  question?: string;
}

export interface VerificationFinding {
  id: string;
  claim: string;
  status: VerificationStatus;
  explanation: string;
  historicalEvidenceIds: string[];
  currentEvidenceIds: string[];
}

export interface VerificationResult {
  id: string;
  historicalSnapshotId: string;
  currentSnapshotId?: string;
  conversationId?: string;
  query: string;
  status: VerificationStatus;
  findings: VerificationFinding[];
  verifiedAt: string;
}

export interface ComparisonResult {
  id: string;
  historicalSnapshotId: string;
  currentSnapshotId: string;
  status: ComparisonStatus;
  historicalEvidenceIds: string[];
  currentEvidenceIds: string[];
  explanation: string;
  comparedAt: string;
}