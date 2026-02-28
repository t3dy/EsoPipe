import sqlite3
import json
from typing import List, Dict, Any
from esopipe2.retrieval import HybridRetriever

class RelationalSidecar:
    """Discovers related archival context for a given generated artifact."""
    def __init__(self, db_path: str, retriever: HybridRetriever):
        self.db_path = db_path
        self.retriever = retriever

    def get_related_context(self, artifact_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        1. Load artifact context snapshot.
        2. Identify core entities/keywords.
        3. Perform a 'Lateral Search' for related but not identical context.
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        
        art = conn.execute("SELECT context_snapshot_json, payload_json FROM artifacts WHERE id = ?", (artifact_id,)).fetchone()
        if not art:
            return []
            
        snapshot = json.loads(art['context_snapshot_json'])
        payload = json.loads(art['payload_json'])
        
        # Extract keywords/entities from snapshot query or payload
        base_query = snapshot.get('query', "")
        
        # Lateral Query: "Related to [X] but focusing on broader context"
        lateral_query = f"lateral explore {base_query} related concepts"
        
        # Search while suppressing already linked sources
        linked_sources = conn.execute("SELECT source_id FROM artifact_sources WHERE artifact_id = ?", (artifact_id,)).fetchall()
        suppress_ids = {s['source_id'] for s in linked_sources}
        
        bundle = self.retriever.search(lateral_query, limit=limit + len(suppress_ids))
        results = [r for r in bundle['results'] if str(r['id']) not in suppress_ids]
        
        conn.close()
        return results[:limit]

if __name__ == "__main__":
    from esopipe2.retrieval import HybridRetriever
    db = "esoteric_archive.db"
    retriever = HybridRetriever(db)
    sidecar = RelationalSidecar(db, retriever)
    
    # Test with one of the recently created artifacts
    # (Need to fetch a real ID first)
    conn = sqlite3.connect(db)
    last_art = conn.execute("SELECT id FROM artifacts ORDER BY rowid DESC LIMIT 1").fetchone()
    conn.close()
    
    if last_art:
        aid = last_art[0]
        print(f"Finding related context for artifact: {aid}")
        related = sidecar.get_related_context(aid)
        for r in related:
            print(f"- Related {r['type'].upper()}: {r['id']} (Score: {r['combined_score']:.3f})")
