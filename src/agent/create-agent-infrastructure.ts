import { env } from "../config/env.js";
import {
  openDatabase,
  type SQLiteDatabase,
} from "../database/sqlite.js";
import { createMemoryStore, type MemoryStore } from "../memory/create-memory-store.js";
import { SearXNGProvider } from "../research/searxng-provider.js";
import { SearchService } from "../research/search-service.js";

export interface AgentInfrastructureConfig {
  databasePath?: string;
  searxngBaseUrl?: string;
  searchFetch?: typeof fetch;
}

export interface AgentInfrastructure {
    database: SQLiteDatabase;
    memoryStore: MemoryStore;
    searchService: SearchService;
    close(): void;
}

export function createAgentInfrastructure(
  config: AgentInfrastructureConfig = {},
): AgentInfrastructure {
  const database: SQLiteDatabase = openDatabase(
    config.databasePath ?? env.DATABASE_PATH,
  );

  try {
    const memoryStore = createMemoryStore(database);

    const searchProvider = new SearXNGProvider({
      baseUrl: config.searxngBaseUrl ?? env.SEARXNG_BASE_URL,
      ...(config.searchFetch
        ? { fetchImpl: config.searchFetch }
        : {}),
    });

    const searchService = new SearchService(searchProvider);

    let closed = false;

    return {
      database,
      memoryStore,
      searchService,

      close() {
        if (!closed) {
          database.close();
          closed = true;
        }
      },
    };
  } catch (error) {
    database.close();
    throw error;
  }
}