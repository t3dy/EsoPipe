import sqlite3
import hashlib
import json
import numpy as np
import argparse
from datetime import datetime
from typing import List, Dict, Any, Optional

# --- Configuration & Constants ---
DEFAULT_DB = "esoteric_archive.db"
MODEL_ID = "all-MiniLM-L6-v2"  # Placeholder for sentence-transformers logic
MODEL_DIMS = 384
RUN_PROVIDER = "local-transformers"

# --- Embedding Engine (Swap this as needed) ---
class DummyEmbedder:
    """Mock embedder for pipeline verification without requiring heavy downloads."""
    def __init__(self, dims: int = 384):
        self.dims = dims
        print(f"Initialized DummyEmbedder with {dims} dimensions.")

    def embed(self, texts: List[str]) -> np.ndarray:
        vectors = []
        for text in texts:
            # Seed based on text hash to make dummy embeddings deterministic
            h = int(hashlib.md5(text.encode()).hexdigest(), 16) % (2**32)
            np.random.seed(h)
            vec = np.random.randn(self.dims).astype(np.float32)
            vectors.append(vec)
        
        vecs = np.array(vectors)
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        return vecs / norms

# In a real environment with torch/transformers:
# class TransformersEmbedder:
#     def __init__(self, model_name: str):
#         from transformers import AutoTokenizer, AutoModel
#         import torch
#         self.tokenizer = AutoTokenizer.from_pretrained(model_name)
#         self.model = AutoModel.from_pretrained(model_name)
#         self.dims = 384
#     ...

# --- Core Logic ---

def get_hash(text: str) -> str:
    """Canonicalize and hash text."""
    # Normalize whitespace
    clean_text = " ".join(text.split()).strip()
    return hashlib.sha256(clean_text.encode('utf-8')).hexdigest()

def index_batch(conn: sqlite3.Connection, run_id: int, items: List[Dict], embedder: Any):
    if not items:
        return
    texts = [it['text'] for it in items]
    vectors = embedder.embed(texts)
    for it, vec in zip(items, vectors):
        blob = vec.tobytes()
        conn.execute("""
            INSERT OR REPLACE INTO object_embeddings (run_id, object_type, object_id, content_hash, embedding)
            VALUES (?, ?, ?, ?, ?)
        """, (run_id, it['type'], it['id'], it['hash'], blob))
    conn.commit()

def index_corpus(db_path: str, force: bool = False):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    embedder = DummyEmbedder(MODEL_DIMS)

    cur = conn.cursor()
    cur.execute("""
        INSERT INTO embedding_runs (provider, model_version, dimensions, normalized, created_at)
        VALUES (?, ?, ?, 1, ?)
    """, (RUN_PROVIDER, MODEL_ID, MODEL_DIMS, datetime.now().isoformat()))
    run_id = cur.lastrowid
    print(f"Started embedding run {run_id} using {MODEL_ID}")

    # --- 1. Index Turns ---
    turns = conn.execute("SELECT id, content FROM turns WHERE role = 'user'").fetchall()
    to_index_turns = []
    for t in turns:
        h = get_hash(t['content'])
        exists = conn.execute("SELECT 1 FROM object_embeddings WHERE object_type='turn' AND object_id=? AND content_hash=?", (str(t['id']), h)).fetchone()
        if not exists or force:
            to_index_turns.append({'id': str(t['id']), 'text': t['content'], 'hash': h, 'type': 'turn'})
    
    # --- 2. Index Entities ---
    entities = conn.execute("SELECT id, label, blurb FROM entities").fetchall()
    to_index_entities = []
    for e in entities:
        text = f"{e['label']}: {e['blurb']}"
        h = get_hash(text)
        exists = conn.execute("SELECT 1 FROM object_embeddings WHERE object_type='entity' AND object_id=? AND content_hash=?", (e['id'], h)).fetchone()
        if not exists or force:
            to_index_entities.append({'id': e['id'], 'text': text, 'hash': h, 'type': 'entity'})

    # --- 3. Index Tables ---
    tables = conn.execute("SELECT id, title, description FROM scholarly_tables").fetchall()
    to_index_tables = []
    for t in tables:
        text = f"Table: {t['title']}. {t['description']}"
        h = get_hash(text)
        exists = conn.execute("SELECT 1 FROM object_embeddings WHERE object_type='table' AND object_id=? AND content_hash=?", (t['id'], h)).fetchone()
        if not exists or force:
            to_index_tables.append({'id': t['id'], 'text': text, 'hash': h, 'type': 'table'})

    all_to_index = to_index_turns + to_index_entities + to_index_tables
    print(f"Total items requiring indexing: {len(all_to_index)} (Turns: {len(to_index_turns)}, Entities: {len(to_index_entities)}, Tables: {len(to_index_tables)})")

    batch_size = 32
    for i in range(0, len(all_to_index), batch_size):
        batch = all_to_index[i:i + batch_size]
        index_batch(conn, run_id, batch, embedder)
        print(f"Indexed batch {i//batch_size + 1}/{(len(all_to_index)-1)//batch_size + 1}")

    conn.close()
    print("Indexing complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=DEFAULT_DB)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    
    index_corpus(args.db, args.force)
