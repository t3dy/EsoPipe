import sqlite3
import os

def apply_migration():
    db_path = 'esoteric_archive.db'
    migration_path = 'esopipe2_migration.sql'
    
    if not os.path.exists(migration_path):
        print(f"Error: {migration_path} not found.")
        return

    with open(migration_path, 'r') as f:
        sql = f.read()

    try:
        conn = sqlite3.connect(db_path)
        conn.executescript(sql)
        conn.commit()
        print("Migration applied successfully via Python.")
    except sqlite3.Error as e:
        print(f"SQLite error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    apply_migration()
