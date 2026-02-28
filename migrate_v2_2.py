import sqlite3
import os

def migrate():
    db_path = 'esoteric_archive.db'
    if not os.path.exists(db_path):
        print("Database not found.")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    try:
        # 1. Rename prompt_embeddings to object_embeddings if it exists
        tables = [r['name'] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        if 'prompt_embeddings' in tables and 'object_embeddings' not in tables:
            print("Renaming prompt_embeddings to object_embeddings...")
            conn.execute("ALTER TABLE prompt_embeddings RENAME TO object_embeddings")
        
        # 2. Rebuild FTS tables as external content tables
        print("Rebuilding FTS tables as external content...")
        
        # Drop old ones (they might be internal or broken)
        conn.execute("DROP TABLE IF EXISTS turns_fts")
        conn.execute("DROP TABLE IF EXISTS entities_fts")
        conn.execute("DROP TABLE IF EXISTS tables_fts")
        
        # Create new ones (using the schema definitions)
        conn.execute("""
            CREATE VIRTUAL TABLE turns_fts USING fts5(
                content,
                content='turns',
                content_rowid='id'
            )
        """)
        
        conn.execute("""
            CREATE VIRTUAL TABLE tables_fts USING fts5(
                title, description, user_request,
                content='scholarly_tables',
                content_rowid='rowid',
                tokenize='unicode61'
            )
        """)
        
        conn.execute("""
            CREATE VIRTUAL TABLE entities_fts USING fts5(
                label, blurb, metadata_json,
                content='entities',
                content_rowid='rowid',
                tokenize='unicode61'
            )
        """)
        
        # Populate/Rebuild
        print("Populating FTS indices...")
        conn.execute("INSERT INTO turns_fts(turns_fts) VALUES('rebuild')")
        conn.execute("INSERT INTO entities_fts(entities_fts) VALUES('rebuild')")
        conn.execute("INSERT INTO tables_fts(tables_fts) VALUES('rebuild')")
        
        conn.commit()
        print("Migration v2.2 complete (ID Canonicalization).")
        
    except sqlite3.Error as e:
        print(f"Migration error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
