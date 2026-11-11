export const DATABASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (
    role IN ('system', 'user', 'assistant', 'tool')
  ),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id)
    REFERENCES conversations(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON conversation_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS memory_records (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (
    kind IN ('fact', 'preference', 'decision', 'context')
  ),
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  source_type TEXT NOT NULL CHECK (
    source_type IN ('conversation', 'research')
  ),
  source_id TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (
    confidence >= 0 AND confidence <= 1
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_source
ON memory_records(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_memory_kind
ON memory_records(kind);

CREATE TABLE IF NOT EXISTS research_snapshots (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,
  query TEXT NOT NULL,
  provider TEXT NOT NULL,
  searched_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id)
    REFERENCES conversations(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_research_conversation
ON research_snapshots(conversation_id);

CREATE INDEX IF NOT EXISTS idx_research_searched_at
ON research_snapshots(searched_at);

CREATE TABLE IF NOT EXISTS research_snapshot_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id TEXT NOT NULL,
  result_order INTEGER NOT NULL CHECK (result_order >= 0),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  snippet TEXT NOT NULL,
  source TEXT NOT NULL,
  published_at TEXT,
  score REAL,
  FOREIGN KEY (snapshot_id)
    REFERENCES research_snapshots(id)
    ON DELETE CASCADE,
  UNIQUE(snapshot_id, result_order)
);

CREATE INDEX IF NOT EXISTS idx_snapshot_results_snapshot
ON research_snapshot_results(snapshot_id, result_order);
`;