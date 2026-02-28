import sqlite3
import numpy as np
import json
from typing import List, Dict, Any, Optional

# Constants matching index_embeddings.py
MODEL_DIMS = 384

class HybridRetriever:
    TYPE_WEIGHTS = {
        'turn': 1.0,
        'table': 1.2,
        'entity': 0.7
    }

    def __init__(self, db_path: str, embedder: Any = None):
        self.db_path = db_path
        self.embedder = embedder # If None, uses Dummy logic for now
        self._ief_cache = {}
        self.last_retrieval_mode = "FTS"

    def _get_query_embedding(self, query: str) -> np.ndarray:
        if self.embedder:
            vec = self.embedder.embed([query])[0]
        else:
            # Fallback to random normalized vector for dummy testing
            vec = np.random.randn(MODEL_DIMS).astype(np.float32)
        
        # Enforce unit-length for true cosine similarity via dot product
        norm = np.linalg.norm(vec)
        return vec / norm if norm > 0 else vec

    def _get_ief(self, conn: sqlite3.Connection, entity_id: str) -> float:
        """Calculate Inverse Entity Frequency: log10(Total Conv / Conv with Entity)."""
        if entity_id in self._ief_cache:
            return self._ief_cache[entity_id]
        
        # Use total conversations as the denominator
        total_conv = conn.execute("SELECT COUNT(*) FROM conversations").fetchone()[0] or 1
        entity_conv = conn.execute(
            "SELECT COUNT(DISTINCT conversation_id) FROM entity_mentions WHERE entity_id = ?", 
            (entity_id,)
        ).fetchone()[0] or 1
        
        ief = np.log10(float(total_conv) / float(entity_conv))
        self._ief_cache[entity_id] = float(ief)
        return float(ief)

    def _get_aggregated_ief(self, conn: sqlite3.Connection, obj_type: str, obj_id: str) -> float:
        """Aggregate IEF rarity for turns and tables based on mentioned entities."""
        if obj_type == 'entity':
            return self._get_ief(conn, obj_id)
        
        if obj_type == 'turn':
            # Boost turns that mention rare entities
            mentions = conn.execute(
                "SELECT entity_id FROM entity_mentions WHERE turn_id = ?", (obj_id,)
            ).fetchall()
            if mentions:
                return max(self._get_ief(conn, m[0]) for m in mentions)
        
        return 0.0

    def _fetch_content(self, conn: sqlite3.Connection, obj_type: str, obj_id: str) -> str:
        """Fetch raw content for an object based on its type and ID."""
        if obj_type == 'turn':
            row = conn.execute("SELECT content FROM turns WHERE id = ?", (obj_id,)).fetchone()
            return str(row['content']) if row else ""
        if obj_type == 'entity':
            row = conn.execute("SELECT label, blurb FROM entities WHERE id = ?", (obj_id,)).fetchone()
            return f"{row['label']}: {row['blurb']}" if row else ""
        if obj_type == 'table':
            row = conn.execute("SELECT title, description FROM scholarly_tables WHERE id = ?", (obj_id,)).fetchone()
            return f"Table: {row['title']}. {row['description']}" if row else ""
        return ""

    def search(self, query: str, limit: int = 10) -> Dict[str, Any]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        
        # 1. Stage 1: FTS Recall
        self.last_retrieval_mode = "FTS"
        # Escape query for FTS (replace ' with '') and strip punctuation that breaks FTS5
        fts_query = query.replace("'", "''").replace(".", " ").replace(",", " ").replace("?", " ")
        
        candidates = []
        
        # Turns (rowid is id)
        try:
            turns = conn.execute("""
                SELECT t.id, 'turn' as type, bm25(turns_fts) as fts_score, t.content 
                FROM turns t JOIN turns_fts f ON t.id = f.rowid 
                WHERE turns_fts MATCH ? LIMIT 100
            """, (fts_query,)).fetchall()
            for r in turns:
                candidates.append({'id': str(r['id']), 'type': 'turn', 'fts_score': -r['fts_score'], 'text': r['content']})
        except sqlite3.Error as e:
            print(f"Turns FTS Error: {e}. Falling back to search.")
            
        # Entities (rowid is linked to entities.rowid)
        try:
            entities = conn.execute("""
                SELECT e.id, 'entity' as type, bm25(entities_fts) as fts_score, e.label, e.blurb
                FROM entities e JOIN entities_fts f ON e.rowid = f.rowid 
                WHERE entities_fts MATCH ? LIMIT 50
            """, (fts_query,)).fetchall()
            for r in entities:
                candidates.append({'id': r['id'], 'type': 'entity', 'fts_score': -r['fts_score'], 'text': f"{r['label']}: {r['blurb']}"})
        except sqlite3.Error as e:
            print(f"Entities FTS Error: {e}. Falling back to search.")
            
        # Tables (rowid is linked to scholarly_tables.rowid)
        try:
            tables = conn.execute("""
                SELECT t.id, 'table' as type, bm25(tables_fts) as fts_score, t.title, t.description
                FROM scholarly_tables t JOIN tables_fts f ON t.rowid = f.rowid 
                WHERE tables_fts MATCH ? LIMIT 50
            """, (fts_query,)).fetchall()
            for r in tables:
                candidates.append({
                    'id': r['id'], 'type': 'table', 'fts_score': -r['fts_score'], 
                    'text': f"Table: {r['title']}. {r['description']}"
                })
        except sqlite3.Error as e:
            print(f"Tables FTS Error: {e}. Falling back to search.")

        if not candidates:
            # Fallback Stage 1.5: Pure Vector Search (Table Scan since corpus is small)
            self.last_retrieval_mode = "VECTOR"
            print("FTS returned no hits. Falling back to global vector scan...")
            query_vec = self._get_query_embedding(query)
            
            # Fetch most recent run
            rows = conn.execute("""
                SELECT object_type, object_id, embedding 
                FROM object_embeddings 
                WHERE run_id = (SELECT MAX(id) FROM embedding_runs)
            """).fetchall()
            
            vec_hits = []
            for r in rows:
                cand_vec = np.frombuffer(r['embedding'], dtype=np.float32)
                sim = np.dot(query_vec, cand_vec)
                vec_hits.append({
                    'id': r['object_id'],
                    'type': r['object_type'],
                    'vector_score': float(sim),
                    'fts_score': 0.0 # No FTS hit
                })
            
            # Take top 50 by vector similarity
            vec_hits.sort(key=lambda x: x['vector_score'], reverse=True)
            for cand in vec_hits[:50]:
                cand['text'] = self._fetch_content(conn, cand['type'], str(cand['id']))
                candidates.append(cand)

        if not candidates:
            # Fallback Stage 1.6: LIKE search (absolute last resort)
            self.last_retrieval_mode = "LIKE"
            print("Vector scan also empty. Falling back to LIKE search...")
            # Turns
            turns = conn.execute("SELECT id, 'turn' as type, 1.0 as fts_score, content FROM turns WHERE content LIKE ? LIMIT 20", (f"%{query}%",)).fetchall()
            for r in turns:
                candidates.append({'id': str(r['id']), 'type': 'turn', 'fts_score': 1.0, 'text': r['content']})
            # Entities
            entities = conn.execute("SELECT id, 'entity' as type, 2.0 as fts_score, label, blurb FROM entities WHERE label LIKE ? OR blurb LIKE ? LIMIT 10", (f"%{query}%", f"%{query}%")).fetchall()
            for r in entities:
                candidates.append({'id': r['id'], 'type': 'entity', 'fts_score': 2.0, 'text': f"{r['label']}: {r['blurb']}"})

        # 2. Stage 2: Vector Rerank
        query_vec = self._get_query_embedding(query)
        
        for cand in candidates:
            # Fetch most recent embedding for this object using canonical ID
            row = conn.execute("""
                SELECT embedding FROM object_embeddings 
                WHERE object_type=? AND object_id=? 
                ORDER BY run_id DESC LIMIT 1
            """, (cand['type'], str(cand['id']))).fetchone()
            
            if row:
                cand_vec = np.frombuffer(row['embedding'], dtype=np.float32).copy()
                # Enforce normalization of candidate if not already (safeguard)
                norm = np.linalg.norm(cand_vec)
                if norm > 0: cand_vec /= norm
                
                sim = np.dot(query_vec, cand_vec)
                cand['vector_score'] = float(sim)
            else:
                cand['vector_score'] = 0.0

        # 3. Fusion & Ranking (Reciprocal Rank Fusion)
        if candidates:
            # Rank by FTS
            candidates.sort(key=lambda x: x.get('fts_score', 0), reverse=True)
            for i, c in enumerate(candidates): c['fts_rank'] = i + 1
            
            # Rank by Vector
            candidates.sort(key=lambda x: x.get('vector_score', 0), reverse=True)
            for i, c in enumerate(candidates): c['vec_rank'] = i + 1
            
            # Fuse Ranks (K=60 is standard)
            K = 60.0
            for c in candidates:
                # Rank-based fusion is more stable than score-based
                rrf_fts = 1.0 / (K + float(c.get('fts_rank', 100)))
                rrf_vec = 1.0 / (K + float(c.get('vec_rank', 100)))
                rrf = rrf_fts + rrf_vec
                
                # Apply Aggregated IEF (rare concept boost)
                ief_boost = 1.0 + (self._get_aggregated_ief(conn, c['type'], str(c['id'])) * 0.2)
                
                type_w = float(self.TYPE_WEIGHTS.get(c['type'], 1.0))
                c['combined_score'] = float(rrf * type_w * ief_boost)

        candidates.sort(key=lambda x: x.get('combined_score', 0), reverse=True)
        
        # 3.4 Context Diversity Heuristic: 
        # Cap items per type to prevent one type (e.g. entities) from flooding
        final_candidates = []
        counts = {'turn': 0, 'entity': 0, 'table': 0}
        caps = {'turn': 5, 'entity': 3, 'table': 3}
        
        for cand in candidates:
            ctype = cand['type']
            if counts[ctype] < caps.get(ctype, 5):
                final_candidates.append(cand)
                counts[ctype] += 1
            if len(final_candidates) >= limit:
                break
        
        # 4. Context Packaging (Metadata lookup)
        results = []
        for cand in final_candidates:
            # Enrich with more data depending on type
            if cand['type'] == 'turn':
                info = conn.execute("SELECT conversation_id, role FROM turns WHERE id=?", (cand['id'],)).fetchone()
                cand['metadata'] = dict(info) if info else {}
            elif cand['type'] == 'entity':
                info = conn.execute("SELECT label, type, metadata_json FROM entities WHERE id=?", (cand['id'],)).fetchone()
                cand['metadata'] = dict(info) if info else {}
            elif cand['type'] == 'table':
                info = conn.execute("SELECT title, template FROM scholarly_tables WHERE id=?", (cand['id'],)).fetchone()
                cand['metadata'] = dict(info) if info else {}
            
            results.append(cand)

        conn.close()
        # Return results wrapped with metadata about the retrieval session
        return {
            "results": results,
            "mode": self.last_retrieval_mode,
            "query": query,
            "limit": limit
        }

def pack_context(results: List[Dict[str, Any]]) -> str:
    """Format results for LLM consumption with metadata-rich tags (v1.1)."""
    output = ["### Archival Context Snapshot (xml-v1.1)\n"]
    for res in results:
        ctype = res['type']
        cid = res['id']
        meta = res.get('metadata', {})
        text = res['text'].strip()
        score = f"{res.get('combined_score', 0):.4f}"
        
        # Build attribute string
        attrs = [f"id=\"{ctype}:{cid}\"", f"score=\"{score}\""]
        if ctype == 'turn':
            attrs.append(f"conv_id=\"{meta.get('conversation_id', '')}\"")
            attrs.append(f"role=\"{meta.get('role', '')}\"")
        elif ctype == 'table':
            attrs.append(f"template=\"{meta.get('template', '')}\"")
            attrs.append(f"title=\"{meta.get('title', '')}\"")
        elif ctype == 'entity':
            attrs.append(f"label=\"{meta.get('label', '')}\"")

        attr_str = " ".join(attrs)
        tag = ctype.upper()
        output.append(f"<{tag} {attr_str}>")
        output.append(text)
        output.append(f"</{tag}>\n")
    return "\n".join(output)

if __name__ == "__main__":
    db = "esoteric_archive.db"
    retriever = HybridRetriever(db)
    query = "Kabbalistic tree of life and emanations"
    print(f"Searching for: {query}\n")
    bundle = retriever.search(query, limit=5)
    results = bundle['results']
    for r in results:
        print(f"[{r['type']:6}] Score: {r['combined_score']:.3f} | {r['text'][:100]}...")
    
    print("\nPacked Context:")
    print(pack_context(results))
