import sqlite3
import json
import argparse
from pathlib import Path

def import_tables(db_path: str, json_path: str):
    conn = sqlite3.connect(db_path)
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            tables = json.load(f)
        
        print(f"Importing {len(tables)} tables from {json_path}...")
        
        for t in tables:
            # We store the full JSON in payload_json for convenience
            conn.execute("""
                INSERT OR REPLACE INTO scholarly_tables 
                (id, template, title, description, user_request, payload_json)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                t['id'], 
                t['template'], 
                t['title'], 
                t.get('description', ''),
                t.get('user_request', ''),
                json.dumps(t)
            ))
        
        conn.commit()
        print("Import successful.")
    except Exception as e:
        print(f"Error importing tables: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="esoteric_archive.db")
    parser.add_argument("--json", default="cs-magical-scholarship/public/data/tables_mined.json")
    args = parser.parse_args()
    
    import_tables(args.db, args.json)
