import type {
  ComparisonResult,
  VerificationResult,
} from "./verification-types.js";

export interface VerificationRepository {
  saveVerificationResult(
    result: VerificationResult,
  ): Promise<void>;

  findVerificationResult(
    id: string,
  ): Promise<VerificationResult | null>;

  saveComparisonResult(
    result: ComparisonResult,
  ): Promise<void>;

  findComparisonResults(
    historicalSnapshotId: string,
    currentSnapshotId: string,
  ): Promise<ComparisonResult[]>;
}