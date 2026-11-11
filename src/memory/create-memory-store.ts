import type { SQLiteDatabase } from "../database/sqlite.js";

import { SQLiteConversationRepository, SQLiteResearchSnapshotRepository } from "./sqlite-repositories.js";
import { SQLiteMemoryRepository } from "./sqlite-memory-repository.js";
import { SQLiteMemorySearchRepository } from "./sqlite-memory-search.js";

export function createMemoryStore(database: SQLiteDatabase) {
  return {
    conversations: new SQLiteConversationRepository(database),
    memories: new SQLiteMemoryRepository(database),
    researchSnapshots: new SQLiteResearchSnapshotRepository(database),
    search: new SQLiteMemorySearchRepository(database),
  };
}

export type MemoryStore = ReturnType<typeof createMemoryStore>;