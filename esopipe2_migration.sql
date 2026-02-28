-- esopipe2_migration.sql
PRAGMA foreign_keys=ON;

-- 1. Embedding Infrastructure
CREATE TABLE IF NOT EXISTS embedding_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL, 
    model_version TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    normalized BOOLEAN DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prompt_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turn_id INTEGER NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
    run_id INTEGER NOT NULL REFERENCES embedding_runs(id) ON DELETE CASCADE,
    content_hash TEXT, 
    embedding BLOB NOT NULL,
    UNIQUE(turn_id, run_id)
);

-- 2. Intent Evaluation
CREATE TABLE IF NOT EXISTS intent_labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turn_id INTEGER NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
    intent_key TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    is_gold_standard BOOLEAN DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Artifact Registry & Provenance
CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY, 
    type TEXT NOT NULL, 
    schema_version TEXT NOT NULL,
    payload_json TEXT NOT NULL, 
    payload_markdown TEXT,      
    context_snapshot_json TEXT, 
    revision_number INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artifact_sources (
    artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL, 
    source_id TEXT NOT NULL,   
    weight REAL DEFAULT 1.0,
    PRIMARY KEY (artifact_id, source_type, source_id)
);

-- 4. FTS5 for Hybrid Retrieval
CREATE VIRTUAL TABLE IF NOT EXISTS turns_fts USING fts5(
    content,
    content='turns',
    content_rowid='id'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS turns_ai AFTER INSERT ON turns BEGIN
  INSERT INTO turns_fts(rowid, content) VALUES (new.id, new.content);
END;
CREATE TRIGGER IF NOT EXISTS turns_ad AFTER DELETE ON turns BEGIN
  INSERT INTO turns_fts(turns_fts, rowid, content) VALUES('delete', old.id, old.content);
END;
CREATE TRIGGER IF NOT EXISTS turns_au AFTER UPDATE ON turns BEGIN
  INSERT INTO turns_fts(turns_fts, rowid, content) VALUES('delete', old.id, old.content);
  INSERT INTO turns_fts(rowid, content) VALUES (new.id, new.content);
END;

-- Populate FTS table
INSERT INTO turns_fts(rowid, content) 
SELECT id, content FROM turns 
WHERE id NOT IN (SELECT rowid FROM turns_fts);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_prompt_embed_turn ON prompt_embeddings(turn_id);
CREATE INDEX IF NOT EXISTS idx_intent_labels_turn ON intent_labels(turn_id);
CREATE INDEX IF NOT EXISTS idx_artifact_sources_id ON artifact_sources(artifact_id);
