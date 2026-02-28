import sqlite3
import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

class ArtifactManager:
    def __init__(self, db_path: str):
        self.db_path = db_path

    def _get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def create_artifact(self, 
                        artifact_type: str, 
                        schema_version: str, 
                        payload: Dict[str, Any], 
                        payload_markdown: Optional[str] = None,
                        context_snapshot: Optional[Dict[str, Any]] = None,
                        sources: List[Dict[str, Any]] = None) -> str:
        """
        Creates a new artifact with provenance links.
        sources: List of {'type': str, 'id': str, 'weight': float}
        """
        artifact_id = str(uuid.uuid4())[:18] # Short unique ID
        now = datetime.now().isoformat()
        
        conn = self._get_conn()
        try:
            conn.execute("""
                INSERT INTO artifacts (id, type, schema_version, payload_json, payload_markdown, context_snapshot_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                artifact_id, 
                artifact_type, 
                schema_version, 
                json.dumps(payload), 
                payload_markdown, 
                json.dumps(context_snapshot) if context_snapshot else None,
                now
            ))
            
            if sources:
                for src in sources:
                    conn.execute("""
                        INSERT INTO artifact_sources (artifact_id, source_type, source_id, weight)
                        VALUES (?, ?, ?, ?)
                    """, (artifact_id, src['type'], src['id'], src.get('weight', 1.0)))
            
            conn.commit()
            return artifact_id
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    def get_artifact(self, artifact_id: str) -> Optional[Dict[str, Any]]:
        conn = self._get_conn()
        try:
            row = conn.execute("SELECT * FROM artifacts WHERE id = ?", (artifact_id,)).fetchone()
            if not row:
                return None
            
            artifact = dict(row)
            artifact['payload'] = json.loads(artifact['payload_json'])
            if artifact['context_snapshot_json']:
                artifact['context_snapshot'] = json.loads(artifact['context_snapshot_json'])
            
            sources = conn.execute("SELECT * FROM artifact_sources WHERE artifact_id = ?", (artifact_id,)).fetchall()
            artifact['sources'] = [dict(s) for s in sources]
            
            return artifact
        finally:
            conn.close()

    def list_artifacts(self, artifact_type: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        try:
            query = "SELECT id, type, created_at FROM artifacts"
            params = []
            if artifact_type:
                query += " WHERE type = ?"
                params.append(artifact_type)
            query += " ORDER BY created_at DESC"
            
            rows = conn.execute(query, params).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()
