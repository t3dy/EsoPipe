import sqlite3
import json
import uuid
import os

from esopipe2.schema import init_schema

DB_PATH = 'esoteric_archive.db'
LEXICON_PATH = os.path.join('AlchemyDB', 'lexicon.json')

def ingest_lexicon():
    # Ensure schema is up to date
    init_schema(DB_PATH)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    with open(LEXICON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print(f"Loaded {len(data)} concepts from {LEXICON_PATH}.")
    
    # Pre-clear old concepts for idempotence (optional, but good for testing)
    cursor.execute("DELETE FROM alchemy_concepts")
    cursor.execute("DELETE FROM alchemy_concepts_fts")
    
    inserted = 0
    for item in data:
        concept_id = "alc_" + str(uuid.uuid4()).replace("-", "")[:12]
        term = item.get('term', '')
        category = item.get('category', 'Uncategorized')
        definition = item.get('definition', '')
        body = item.get('body', '')
        
        cursor.execute("""
            INSERT INTO alchemy_concepts (id, term, category, definition, body)
            VALUES (?, ?, ?, ?, ?)
        """, (concept_id, term, category, definition, body))
        
        # Insert into FTS
        # FTS content_rowid defaults to the actual rowid of alchemy_concepts
        cursor.execute("SELECT rowid FROM alchemy_concepts WHERE id = ?", (concept_id,))
        rowid = cursor.fetchone()[0]
        
        cursor.execute("""
            INSERT INTO alchemy_concepts_fts (rowid, term, definition, body)
            VALUES (?, ?, ?, ?)
        """, (rowid, term, definition, body))
        
        inserted += 1
        
    conn.commit()
    conn.close()
    print(f"Successfully ingrained {inserted} alchemical concepts into {DB_PATH}.")

if __name__ == "__main__":
    ingest_lexicon()
