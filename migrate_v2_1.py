import sqlite3
import argparse

def migrate_db(db_path: str):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # 1. Check if prompt_embeddings needs refactor
    try:
        cur.execute("SELECT object_type FROM prompt_embeddings LIMIT 1")
        print("Schema already updated.")
    except sqlite3.OperationalError:
        print("Migrating prompt_embeddings table...")
        # Since this is a dev phase, we can drop and recreate
        # In a real app, we would add columns and migrate turn_id -> object_id
        cur.execute("DROP TABLE IF EXISTS prompt_embeddings")
        cur.execute("""
            CREATE TABLE prompt_embeddings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL REFERENCES embedding_runs(id) ON DELETE CASCADE,
                object_type TEXT NOT NULL, -- 'turn', 'table', 'entity'
                object_id TEXT NOT NULL,   -- turn_id, entity_id, or table_id
                content_hash TEXT, 
                embedding BLOB NOT NULL,
                UNIQUE(run_id, object_type, object_id)
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_prompt_embed_obj ON prompt_embeddings(object_type, object_id)")
        print("Migration complete.")
    
    # 2. Ensure scholarly_tables and entities exist
    cur.execute("""
        CREATE TABLE IF NOT EXISTS scholarly_tables (
            id TEXT PRIMARY KEY,
            template TEXT,
            title TEXT,
            description TEXT,
            user_request TEXT,
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS entities (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            label TEXT NOT NULL,
            blurb TEXT,
            metadata_json TEXT
        )
    """)
    
    # 3. FTS5 Tables
    cur.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS turns_fts USING fts5(
            content,
            content='turns',
            content_rowid='id'
        )
    """)
    cur.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS tables_fts USING fts5(
            title, description, user_request,
            content='scholarly_tables',
            content_rowid='id'
        )
    """)
    cur.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
            label, blurb, metadata_json,
            content='entities',
            content_rowid='id'
        )
    """)
    
    cur.execute("INSERT INTO entities_fts(entities_fts) VALUES('rebuild')")
    
    # Also for turns and tables just in case they have data
    try:
        cur.execute("INSERT INTO turns_fts(turns_fts) VALUES('rebuild')")
        cur.execute("INSERT INTO tables_fts(tables_fts) VALUES('rebuild')")
    except sqlite3.OperationalError:
        pass # Might fail if source table empty
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate_db('esoteric_archive.db')
