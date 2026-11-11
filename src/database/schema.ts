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

-- Searchable document storage
CREATE TABLE IF NOT EXISTS memory_search_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL CHECK (
    source_type IN ('conversation_message', 'memory_record')
  ),
  source_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  kind TEXT,
  UNIQUE(source_type, source_id)
);

-- Full-text search index
CREATE VIRTUAL TABLE IF NOT EXISTS memory_search_index
USING fts5(
  content,
  content='memory_search_documents',
  content_rowid='id',
  tokenize='unicode61'
);

-- Keep the FTS5 index synchronized with its document table.
CREATE TRIGGER IF NOT EXISTS memory_search_documents_ai
AFTER INSERT ON memory_search_documents
BEGIN
  INSERT INTO memory_search_index(rowid, content)
  VALUES (new.id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS memory_search_documents_ad
AFTER DELETE ON memory_search_documents
BEGIN
  INSERT INTO memory_search_index(
    memory_search_index,
    rowid,
    content
  )
  VALUES ('delete', old.id, old.content);
END;

CREATE TRIGGER IF NOT EXISTS memory_search_documents_au
AFTER UPDATE ON memory_search_documents
BEGIN
  INSERT INTO memory_search_index(
    memory_search_index,
    rowid,
    content
  )
  VALUES ('delete', old.id, old.content);

  INSERT INTO memory_search_index(rowid, content)
  VALUES (new.id, new.content);
END;

-- Index newly inserted conversation messages.
CREATE TRIGGER IF NOT EXISTS conversation_messages_search_ai
AFTER INSERT ON conversation_messages
BEGIN
  INSERT OR IGNORE INTO memory_search_documents (
    source_type,
    source_id,
    content,
    created_at,
    kind
  )
  VALUES (
    'conversation_message',
    new.id,
    new.content,
    new.created_at,
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS conversation_messages_search_ad
AFTER DELETE ON conversation_messages
BEGIN
  DELETE FROM memory_search_documents
  WHERE source_type = 'conversation_message'
    AND source_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS conversation_messages_search_au
AFTER UPDATE ON conversation_messages
BEGIN
  UPDATE memory_search_documents
  SET content = new.content,
      created_at = new.created_at
  WHERE source_type = 'conversation_message'
    AND source_id = old.id;
END;

-- Index newly inserted memory records.
CREATE TRIGGER IF NOT EXISTS memory_records_search_ai
AFTER INSERT ON memory_records
BEGIN
  INSERT OR IGNORE INTO memory_search_documents (
    source_type,
    source_id,
    content,
    created_at,
    kind
  )
  VALUES (
    'memory_record',
    new.id,
    new.content,
    new.created_at,
    new.kind
  );
END;

CREATE TRIGGER IF NOT EXISTS memory_records_search_ad
AFTER DELETE ON memory_records
BEGIN
  DELETE FROM memory_search_documents
  WHERE source_type = 'memory_record'
    AND source_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS memory_records_search_au
AFTER UPDATE ON memory_records
BEGIN
  UPDATE memory_search_documents
  SET content = new.content,
      created_at = new.created_at,
      kind = new.kind
  WHERE source_type = 'memory_record'
    AND source_id = old.id;
END;

-- Backfill records that existed before the search index was introduced.
INSERT OR IGNORE INTO memory_search_documents (
  source_type,
  source_id,
  content,
  created_at,
  kind
)
SELECT
  'conversation_message',
  id,
  content,
  created_at,
  NULL
FROM conversation_messages;

INSERT OR IGNORE INTO memory_search_documents (
  source_type,
  source_id,
  content,
  created_at,
  kind
)
SELECT
  'memory_record',
  id,
  content,
  created_at,
  kind
FROM memory_records;
`;