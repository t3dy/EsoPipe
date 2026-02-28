import sqlite3
import json
import uuid
import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from esopipe2.retrieval import HybridRetriever, pack_context

class CommandProcessor:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.retriever = HybridRetriever(db_path)

    def execute_whois(self, entity_label: str):
        print(f"Executing /whois for: {entity_label}")
        
        # 1. Retrieval
        bundle = self.retriever.search(entity_label, limit=10)
        results = bundle['results']
        mode = bundle['mode']
        context = pack_context(results)
        
        # 2. Mock Generation (Simulating LLM Output based on WhoIsSchema)
        # In a real scenario, this would call an LLM with 'context' and a system prompt.
        artifact_id = f"art_{uuid.uuid4().hex[:8]}"
        
        # Try to find the exact entity for better metadata
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        entity_row = conn.execute(
            "SELECT * FROM entities WHERE label LIKE ? OR id = ?", 
            (f"%{entity_label}%", entity_label)
        ).fetchone()
        
        payload = {
            "entity_id": entity_row['id'] if entity_row else "unknown",
            "full_name": entity_row['label'] if entity_row else entity_label,
            "summary": f"Generated scholarly dossier for {entity_label} based on archival context.",
            "biographical_sketch": entity_row['blurb'] if entity_row else "No blurb available.",
            "citations": [
                {"source_id": r['id'], "snippet": r['text'][:100]} for r in results[:3]
            ]
        }
        
        # 3. Persistence
        try:
            # Artifact Record
            conn.execute("""
                INSERT INTO artifacts (id, type, schema_version, payload_json, context_snapshot_json)
                VALUES (?, ?, ?, ?, ?)
            """, (
                artifact_id, 
                "whois", 
                "1.0.0", 
                json.dumps(payload), 
                json.dumps({
                    "query": entity_label,
                    "retrieval_mode": mode,
                    "retrieval_stats": {"count": len(results)},
                    "packed_context": context
                })
            ))
            
            # Source Provenance
            for r in results:
                conn.execute("""
                    INSERT INTO artifact_sources (artifact_id, source_type, source_id, weight)
                    VALUES (?, ?, ?, ?)
                """, (artifact_id, r['type'], r['id'], r['combined_score']))
            
            # Session Logging
            session_id = f"sess_{uuid.uuid4().hex[:8]}"
            conn.execute("""
                INSERT INTO generation_sessions (id, command, input, artifact_id, model_version)
                VALUES (?, ?, ?, ?, ?)
            """, (session_id, "whois", entity_label, artifact_id, "mock-v1"))
            
            conn.commit()
            print(f"Success! Created artifact {artifact_id}")
            return artifact_id
        except Exception as e:
            print(f"Persistence error: {e}")
            conn.rollback()
            return None
        finally:
            conn.close()

    def execute_compare(self, entity_a: str, entity_b: str, focus: Optional[str] = None):
        print(f"Executing /compare for: {entity_a} vs {entity_b}")
        
        # 1. Retrieval Recipe: Triple Search
        bundle_a = self.retriever.search(entity_a, limit=10)
        bundle_b = self.retriever.search(entity_b, limit=10)
        joint_query = f"{entity_a} {entity_b} compare contrast"
        if focus: joint_query += f" focus on {focus}"
        bundle_joint = self.retriever.search(joint_query, limit=10)
        
        # Merge results (Dedup by type:id)
        seen = set()
        merged = []
        for bundle in [bundle_joint, bundle_a, bundle_b]:
            for r in bundle['results']:
                uid = f"{r['type']}:{r['id']}"
                if uid not in seen:
                    merged.append(r)
                    seen.add(uid)
        
        # 2. Mock Generation (CompareSchema v1)
        artifact_id = f"art_{uuid.uuid4().hex[:8]}"
        payload = {
            "entity_a_id": entity_a,
            "entity_b_id": entity_b,
            "thesis": f"A comparative study of {entity_a} and {entity_b} within the archival tradition.",
            "comparison_axes": [
                {
                    "axis_name": "Metaphysical Grounding",
                    "a_position": f"Primary focus on {entity_a}'s unique approach.",
                    "b_position": f"Contrast with {entity_b}'s derivation.",
                    "evidence": [merged[0]['id']] if merged else [],
                    "synthesis": "Both share a root in Neoplatonism but diverge on mediation."
                },
                {
                    "axis_name": "Historical Context",
                    "a_position": "Renaissance Florence.",
                    "b_position": "Medieval Persia.",
                    "evidence": [merged[1]['id']] if len(merged) > 1 else [],
                    "synthesis": "Geographic distance hides strong conceptual mapping."
                }
            ],
            "caveats": "Limited overlap in direct conversational mentions.",
            "suggested_readings": ["Source A-123", "Source B-456"]
        }
        
        # 3. Persistence
        conn = sqlite3.connect(self.db_path)
        try:
            conn.execute("""
                INSERT INTO artifacts (id, type, schema_version, payload_json, context_snapshot_json)
                VALUES (?, ?, ?, ?, ?)
            """, (
                artifact_id, "compare", "1.0.0", json.dumps(payload),
                json.dumps({
                    "query": f"{entity_a} vs {entity_b}",
                    "retrieval_mode": "triple_search_merge",
                    "packed_context": pack_context(merged[:15])
                })
            ))
            
            # Session Logging
            session_id = f"sess_{uuid.uuid4().hex[:8]}"
            conn.execute("""
                INSERT INTO generation_sessions (id, command, input, artifact_id, model_version)
                VALUES (?, ?, ?, ?, ?)
            """, (session_id, "compare", f"{entity_a} {entity_b}", artifact_id, "mock-v1"))
            
            conn.commit()
            print(f"Success! Created comparison {artifact_id}")
            return artifact_id
        except Exception as e:
            print(f"Persistence error: {e}")
            conn.rollback()
            return None
        finally:
            conn.close()

    def execute_audit(self, claim: str):
        print(f"Executing /audit for: {claim}")
        
        # 1. Retrieval Recipe: Argumentative Booster
        # We boost markers like "because", "however", "therefore"
        boosted_query = f"{claim} because therefore however lacuna contradiction"
        bundle = self.retriever.search(boosted_query, limit=15)
        results = bundle['results']
        
        # 2. Mock Generation (AuditSchema v1)
        artifact_id = f"art_{uuid.uuid4().hex[:8]}"
        payload = {
            "claim": claim,
            "steelman": f"A robust version of the claim regarding {claim}.",
            "evidence_for": [
                {"point": "Archival confirmation found in Turn X.", "sources": [results[0]['id']] if results else []}
            ],
            "evidence_against": [
                {"point": "Contradictory evidence in Table Y.", "sources": [results[1]['id']] if len(results) > 1 else []},
                {"point": "Conceptual tension in Turn Z.", "sources": [results[2]['id']] if len(results) > 2 else []}
            ],
            "assumptions": ["Assumes X is true.", "Relies on Y definition."],
            "lacunae": ["Missing mention of Z.", "Unknown provenance for W.", "Temporal gap in V."],
            "research_questions": ["How does A affect B?", "Is C really D?"],
            "confidence_estimate": 0.75,
            "confidence_explanation": "Strong textual evidence for, but significant lacunae in the secondary sources."
        }
        
        # 3. Persistence
        conn = sqlite3.connect(self.db_path)
        try:
            conn.execute("""
                INSERT INTO artifacts (id, type, schema_version, payload_json, context_snapshot_json)
                VALUES (?, ?, ?, ?, ?)
            """, (
                artifact_id, "audit", "1.0.0", json.dumps(payload),
                json.dumps({
                    "query": claim,
                    "retrieval_mode": bundle['mode'],
                    "packed_context": pack_context(results)
                })
            ))
            
            # Session Logging
            session_id = f"sess_{uuid.uuid4().hex[:8]}"
            conn.execute("""
                INSERT INTO generation_sessions (id, command, input, artifact_id, model_version)
                VALUES (?, ?, ?, ?, ?)
            """, (session_id, "audit", claim, artifact_id, "mock-v1"))
            
            conn.commit()
            print(f"Success! Created audit {artifact_id}")
            return artifact_id
        except Exception as e:
            print(f"Persistence error: {e}")
            conn.rollback()
            return None
        finally:
            conn.close()

if __name__ == "__main__":
    db = "esoteric_archive.db"
    proc = CommandProcessor(db)
    
    # Test /whois
    proc.execute_whois("Pico della Mirandola")
    
    # Test /compare
    proc.execute_compare("Pico della Mirandola", "Marsilio Ficino")
    
    # Test /audit
    proc.execute_audit("The Platonic Academy in Florence was a formal institution.")
