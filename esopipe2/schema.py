import sqlite3
import os

SCHEMA_V2 = """
-- Schema Version Table
CREATE TABLE IF NOT EXISTS schema_versions (
    version_id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Core tables are assumed to exist from v0.1

-- EsoPipe 2.0 Additions
CREATE TABLE IF NOT EXISTS embedding_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL, 
    model_version TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    normalized BOOLEAN DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS object_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES embedding_runs(id) ON DELETE CASCADE,
    object_type TEXT NOT NULL, -- 'turn', 'table', 'entity'
    object_id TEXT NOT NULL,   -- turn_id, entity_id, or table_id
    content_hash TEXT, 
    embedding BLOB NOT NULL,
    UNIQUE(run_id, object_type, object_id)
);

CREATE TABLE IF NOT EXISTS scholarly_tables (
    id TEXT PRIMARY KEY,
    template TEXT,
    title TEXT,
    description TEXT,
    user_request TEXT,
    payload_json TEXT NOT NULL, -- The full JSON structure for the frontend
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    blurb TEXT,
    metadata_json TEXT -- aliases, tags, etc.
);

CREATE TABLE IF NOT EXISTS intent_labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turn_id INTEGER NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
    intent_key TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    is_gold_standard BOOLEAN DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS generation_sessions (
    id TEXT PRIMARY KEY,
    command TEXT NOT NULL,
    input TEXT NOT NULL,
    artifact_id TEXT REFERENCES artifacts(id),
    model_version TEXT,
    retrieval_stats_json TEXT, -- counts per type, latency, etc.
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- FTS5 Virtual Tables (External Content)
CREATE VIRTUAL TABLE IF NOT EXISTS turns_fts USING fts5(
    content,
    content='turns',
    content_rowid='id'
);

CREATE VIRTUAL TABLE IF NOT EXISTS tables_fts USING fts5(
    title, description, user_request,
    content='scholarly_tables',
    content_rowid='rowid',
    tokenize='unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
    label, blurb, metadata_json,
    content='entities',
    content_rowid='rowid',
    tokenize='unicode61'
);

-- Note: We need triggers to keep these in sync if we update them later,
-- but for now, they are mostly bulk-imported.
"""

def init_schema(db_path: str):
    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(SCHEMA_V2)
        conn.commit()
    except sqlite3.Error as e:
        print(f"Schema init error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    init_schema('esoteric_archive.db')
