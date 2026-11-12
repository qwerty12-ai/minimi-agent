import type { SQLiteDatabase } from "../database/sqlite.js";

import type {
  ComparisonResult,
  VerificationResult,
} from "../agent/verification-types.js";

import type {
  VerificationRepository,
} from "../agent/verification-repository.js";

import {
  parseComparisonResult,
  parseVerificationResult,
} from "../agent/verification-schema.js";

interface VerificationRow {
  id: string;
  historical_snapshot_id: string;
  current_snapshot_id: string | null;
  conversation_id: string | null;
  query: string;
  status: VerificationResult["status"];
  findings_json: string;
  verified_at: string;
}

interface ComparisonRow {
  id: string;
  historical_snapshot_id: string;
  current_snapshot_id: string;
  status: ComparisonResult["status"];
  historical_evidence_ids_json: string;
  current_evidence_ids_json: string;
  explanation: string;
  compared_at: string;
}

export class SQLiteVerificationRepository
  implements VerificationRepository {
  constructor(
    private readonly database: SQLiteDatabase,
  ) {}

  async saveVerificationResult(
    result: VerificationResult,
  ): Promise<void> {
    const parsed = parseVerificationResult(result);

    const validated: VerificationResult = {
      id: parsed.id,
      historicalSnapshotId: parsed.historicalSnapshotId,
      ...(parsed.currentSnapshotId !== undefined
        ? { currentSnapshotId: parsed.currentSnapshotId }
        : {}),
      ...(parsed.conversationId !== undefined
        ? { conversationId: parsed.conversationId }
        : {}),
      query: parsed.query,
      status: parsed.status,
      findings: parsed.findings,
      verifiedAt: parsed.verifiedAt,
    };

    this.database.prepare(`
      INSERT INTO verification_results (
        id,
        historical_snapshot_id,
        current_snapshot_id,
        conversation_id,
        query,
        status,
        findings_json,
        verified_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      validated.id,
      validated.historicalSnapshotId,
      validated.currentSnapshotId ?? null,
      validated.conversationId ?? null,
      validated.query,
      validated.status,
      JSON.stringify(validated.findings),
      validated.verifiedAt,
    );
  }

  async findVerificationResult(
    id: string,
  ): Promise<VerificationResult | null> {
    const row = this.database.prepare(`
      SELECT
        id,
        historical_snapshot_id,
        current_snapshot_id,
        conversation_id,
        query,
        status,
        findings_json,
        verified_at
      FROM verification_results
      WHERE id = ?
    `).get(id) as VerificationRow | undefined;

    if (!row) {
      return null;
    }

    const findings: unknown = JSON.parse(row.findings_json);

    const parsed = parseVerificationResult({
      id: row.id,
      historicalSnapshotId: row.historical_snapshot_id,
      ...(row.current_snapshot_id !== null
        ? { currentSnapshotId: row.current_snapshot_id }
        : {}),
      ...(row.conversation_id !== null
        ? { conversationId: row.conversation_id }
        : {}),
      query: row.query,
      status: row.status,
      findings,
      verifiedAt: row.verified_at,
    });

    const validated: VerificationResult = {
      id: parsed.id,
      historicalSnapshotId: parsed.historicalSnapshotId,
      ...(parsed.currentSnapshotId !== undefined
        ? { currentSnapshotId: parsed.currentSnapshotId }
        : {}),
      ...(parsed.conversationId !== undefined
        ? { conversationId: parsed.conversationId }
        : {}),
      query: parsed.query,
      status: parsed.status,
      findings: parsed.findings,
      verifiedAt: parsed.verifiedAt,
    };

    return validated;
  }

  async saveComparisonResult(
    result: ComparisonResult,
  ): Promise<void> {
    const validated = parseComparisonResult(result);

    this.database.prepare(`
      INSERT INTO comparison_results (
        id,
        historical_snapshot_id,
        current_snapshot_id,
        status,
        historical_evidence_ids_json,
        current_evidence_ids_json,
        explanation,
        compared_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      validated.id,
      validated.historicalSnapshotId,
      validated.currentSnapshotId,
      validated.status,
      JSON.stringify(validated.historicalEvidenceIds),
      JSON.stringify(validated.currentEvidenceIds),
      validated.explanation,
      validated.comparedAt,
    );
  }

  async findComparisonResults(
    historicalSnapshotId: string,
    currentSnapshotId: string,
  ): Promise<ComparisonResult[]> {
    const rows = this.database.prepare(`
      SELECT
        id,
        historical_snapshot_id,
        current_snapshot_id,
        status,
        historical_evidence_ids_json,
        current_evidence_ids_json,
        explanation,
        compared_at
      FROM comparison_results
      WHERE historical_snapshot_id = ?
        AND current_snapshot_id = ?
      ORDER BY compared_at ASC, id ASC
    `).all(
      historicalSnapshotId,
      currentSnapshotId,
    ) as ComparisonRow[];

    return rows.map((row) => {
      const historicalEvidenceIds: unknown =
        JSON.parse(row.historical_evidence_ids_json);

      const currentEvidenceIds: unknown =
        JSON.parse(row.current_evidence_ids_json);

      return parseComparisonResult({
        id: row.id,
        historicalSnapshotId: row.historical_snapshot_id,
        currentSnapshotId: row.current_snapshot_id,
        status: row.status,
        historicalEvidenceIds,
        currentEvidenceIds,
        explanation: row.explanation,
        comparedAt: row.compared_at,
      });
    });
  }
}