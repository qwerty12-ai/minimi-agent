import type { SQLiteDatabase } from "../database/sqlite.js";

import type {
  MemoryRecord,
  MemoryRepository,
  MemorySourceType,
} from "./types.js";

import { parseMemoryRecord } from "./memory-schema.js";

interface MemoryRecordRow {
  id: string;
  kind: MemoryRecord["kind"];
  content: string;
  source_type: MemorySourceType;
  source_id: string;
  confidence: number;
  created_at: string;
  updated_at: string;
}

function mapMemoryRecord(row: MemoryRecordRow): MemoryRecord {
  return parseMemoryRecord({
    id: row.id,
    kind: row.kind,
    content: row.content,
    sourceType: row.source_type,
    sourceId: row.source_id,
    confidence: row.confidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class SQLiteMemoryRepository implements MemoryRepository {
  constructor(
    private readonly database: SQLiteDatabase
  ) {}

  async save(memory: MemoryRecord): Promise<void> {
    const validated = parseMemoryRecord(memory);

    this.database.prepare(`
      INSERT INTO memory_records (
        id,
        kind,
        content,
        source_type,
        source_id,
        confidence,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        kind = excluded.kind,
        content = excluded.content,
        source_type = excluded.source_type,
        source_id = excluded.source_id,
        confidence = excluded.confidence,
        updated_at = excluded.updated_at
    `).run(
      validated.id,
      validated.kind,
      validated.content,
      validated.sourceType,
      validated.sourceId,
      validated.confidence,
      validated.createdAt,
      validated.updatedAt
    );
  }

  async findById(id: string): Promise<MemoryRecord | null> {
    const row = this.database.prepare(`
      SELECT
        id,
        kind,
        content,
        source_type,
        source_id,
        confidence,
        created_at,
        updated_at
      FROM memory_records
      WHERE id = ?
    `).get(id) as MemoryRecordRow | undefined;

    return row ? mapMemoryRecord(row) : null;
  }

  async findBySource(
    sourceType: MemorySourceType,
    sourceId: string
  ): Promise<MemoryRecord[]> {
    const rows = this.database.prepare(`
      SELECT
        id,
        kind,
        content,
        source_type,
        source_id,
        confidence,
        created_at,
        updated_at
      FROM memory_records
      WHERE source_type = ?
        AND source_id = ?
      ORDER BY created_at ASC, id ASC
    `).all(sourceType, sourceId) as MemoryRecordRow[];

    return rows.map(mapMemoryRecord);
  }
}