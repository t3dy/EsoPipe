import sqlite3
import json
import time
from typing import List, Dict, Set, Any
from esopipe2.retrieval import HybridRetriever

GOLD_QUERIES = [
    {"query": "Pico della Mirandola", "expected": {"entity:egistusco", "entity:thinker_pico"}},
    {"query": "Marsilio Ficino", "expected": {"entity:thinker_ficino"}},
    {"query": "Aristotle", "expected": {"entity:thinker_aristotle"}},
    {"query": "Pythagoras", "expected": {"entity:thinker_pythagoras"}},
    {"query": "Ibn Sina", "expected": {"entity:thinker_ibnsina"}},
    {"query": "memory palace", "expected": {"entity:concept_memory_palace"}},
    {"query": "magic squares", "expected": {"entity:concept_magic_squares"}},
    {"query": "the One", "expected": {"entity:concept_the_one"}},
    {"query": "Kabbalah", "expected": {"entity:tradition_kabbalah"}},
    {"query": "Hermeticism", "expected": {"entity:tradition_hermeticism"}},
    {"query": "Platonism", "expected": {"entity:tradition_platonism"}},
    {"query": "Emanations", "expected": {"entity:concept_the_one"}},
]

def run_eval(db_path: str):
    retriever = HybridRetriever(db_path)
    
    total = len(GOLD_QUERIES)
    recall_at_5 = 0
    recall_at_10 = 0
    total_mrr = 0.0
    total_latency = 0.0
    
    print(f"Running Retrieval Evaluation (N={total})...\n")
    print(f"{'Query':<30} | R@5 | R@10 | MRR  | Latency")
    print("-" * 75)
    
    for item in GOLD_QUERIES:
        query: str = str(item['query'])
        expected: Set[str] = set(item['expected']) # type: ignore
        
        start = time.time()
        bundle = retriever.search(query, limit=10)
        results: List[Dict[str, Any]] = bundle['results']
        mode: str = bundle['mode']
        latency = (time.time() - start) * 1000
        total_latency += latency
        
        # results are dicts with {id, type, ...} -> build typed IDs
        found_typed_ids = [f"{r['type']}:{r['id']}" for r in results]
        found_at_5 = set(found_typed_ids[:5])
        found_at_10 = set(found_typed_ids)
        
        r5 = 1 if expected.intersection(found_at_5) else 0
        r10 = 1 if expected.intersection(found_at_10) else 0
        
        # Calculate RR (Reciprocal Rank)
        rr = 0.0
        for i, tid in enumerate(found_typed_ids):
            if tid in expected:
                rr = 1.0 / (i + 1)
                break
        
        recall_at_5 += r5
        recall_at_10 += r10
        total_mrr += rr
        
        status_r5 = "✓" if r5 else "✗"
        status_r10 = "✓" if r10 else "✗"
        
        mode_char = mode[0]
        print(f"{query[:30]:<30} |  {status_r5}  |  {status_r10}   | {rr:.2f} | {latency:4.0f}ms | {mode_char}")
    
    print("-" * 75)
    print(f"Mean R@5:  {recall_at_5/total:.2%}")
    print(f"Mean R@10: {recall_at_10/total:.2%}")
    print(f"Mean MRR:  {total_mrr/total:.3f}")
    print(f"Avg Latency: {total_latency/total:.1f}ms")

if __name__ == "__main__":
    run_eval("esoteric_archive.db")
