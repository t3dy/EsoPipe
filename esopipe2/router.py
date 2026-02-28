import sqlite3
import numpy as np
import json
from typing import List, Dict, Any, Optional, Tuple
from esopipe2.retrieval import HybridRetriever

class IntentRouter:
    def __init__(self, db_path: str, retriever: HybridRetriever):
        self.db_path = db_path
        self.retriever = retriever
        self.centroids: Dict[str, np.ndarray] = {}
        self.threshold = 0.1  # Lowered for DummyEmbedder sensitivity
        self.cache_path = "intent_centroids.json"

    def save_centroids(self):
        """Persist centroids to a JSON file."""
        serializable = {k: v.tolist() for k, v in self.centroids.items()}
        with open(self.cache_path, "w") as f:
            json.dump(serializable, f)
        print(f"Centroids saved to {self.cache_path}")

    def load_centroids(self) -> bool:
        """Load centroids from cache."""
        try:
            with open(self.cache_path, "r") as f:
                data = json.load(f)
            self.centroids = {k: np.array(v) for k, v in data.items()}
            return True
        except FileNotFoundError:
            return False

    def train(self):
        """Build intent centroids from generation_sessions data."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        
        # 1. Fetch all session inputs with labels
        rows = conn.execute("SELECT command, input FROM generation_sessions").fetchall()
        
        # Group inputs by command
        intent_data: Dict[str, List[str]] = {}
        for r in rows:
            cmd = r['command']
            if cmd not in intent_data: intent_data[cmd] = []
            intent_data[cmd].append(r['input'])
        
        # 2. Compute embeddings and centroids
        for cmd, texts in intent_data.items():
            vectors = []
            for t in texts:
                # Use retriever's embedder logic
                vec = self.retriever._get_query_embedding(t)
                vectors.append(vec)
            
            # Mean vector for this intent
            centroid = np.mean(vectors, axis=0)
            # Re-normalize to unit length for cosine
            norm = np.linalg.norm(centroid)
            if norm > 0: centroid /= norm
            self.centroids[cmd] = centroid
        
        conn.close()
        print(f"Router trained on {len(self.centroids)} intents: {list(self.centroids.keys())}")

    def predict(self, query: str) -> Tuple[str, float]:
        """Classify query using nearest centroid similarity + keyword heuristic."""
        if not self.centroids:
            self.train()
        
        query_vec = self.retriever._get_query_embedding(query)
        query_words = set(query.lower().split())
        
        best_intent = "general_search"
        best_score = 0.0
        
        # Load training keywords for better dummy mapping
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        training_samples = conn.execute("SELECT command, input FROM generation_sessions").fetchall()
        conn.close()

        for intent, centroid in self.centroids.items():
            # 1. Embedding Similarity
            sim = float(np.dot(query_vec, centroid))
            
            # 2. Keyword Heuristic (Boost for DummyEmbedder)
            # Find the best keyword overlap for this intent
            max_overlap = 0
            for row in training_samples:
                if row['command'] == intent:
                    sample_words = set(row['input'].lower().split())
                    overlap = len(query_words.intersection(sample_words)) / max(1, len(sample_words))
                    max_overlap = max(max_overlap, overlap)
            
            # Combine signals (Weighting keyword overlap heavily for the dummy case)
            final_score = (sim * 0.2) + (max_overlap * 0.8)
            
            if final_score > best_score:
                best_score = final_score
                best_intent = intent
        
        # Apply threshold check
        if best_score < self.threshold:
            return "general_search", best_score
            
        return best_intent, best_score

if __name__ == "__main__":
    from esopipe2.retrieval import HybridRetriever
    db = "esoteric_archive.db"
    retriever = HybridRetriever(db)
    router = IntentRouter(db, retriever)
    
    # Test queries
    test_queries = [
        "Tell me about Pico della Mirandola", # expect whois
        "Compare Ficino and Pico on emanations", # expect compare
        "The academy was a formal legal entity in Florence", # expect audit
        "What is the weather in Renaissance Florence?" # expect general_search (out of distribution)
    ]
    
    for q in test_queries:
        intent, score = router.predict(q)
        print(f"Query: '{q[:40]}...' -> Intent: {intent} (S={score:.3f})")
