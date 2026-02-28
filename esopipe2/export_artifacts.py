import sqlite3
import json
import os
from datetime import datetime

def export_artifacts(db_path: str, output_path: str):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    # Fetch all artifacts
    artifacts_rows = conn.execute("SELECT * FROM artifacts ORDER BY created_at DESC").fetchall()
    
    # Fetch all sources for each artifact
    sources_rows = conn.execute("SELECT * FROM artifact_sources").fetchall()
    sources_map = {}
    for src in sources_rows:
        aid = src['artifact_id']
        if aid not in sources_map:
            sources_map[aid] = []
        sources_map[aid].append({
            'source_type': src['source_type'],
            'source_id': src['source_id'],
            'weight': src['weight']
        })
    
    artifacts = []
    for row in artifacts_rows:
        aid = row['id']
        artifacts.append({
            'id': aid,
            'type': row['type'],
            'schema_version': row['schema_version'],
            'payload': json.loads(row['payload_json']),
            'payload_markdown': row['payload_markdown'],
            'context_snapshot': json.loads(row['context_snapshot_json']) if row['context_snapshot_json'] else None,
            'revision_number': row['revision_number'],
            'created_at': row['created_at'],
            'sources': sources_map.get(aid, [])
        })
    
    # Write to JSON
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(artifacts, f, indent=2)
    
    print(f"Exported {len(artifacts)} artifacts to {output_path}")

if __name__ == "__main__":
    db = 'esoteric_archive.db'
    out = os.path.join('cs-magical-scholarship', 'public', 'data', 'artifacts.json')
    export_artifacts(db, out)
