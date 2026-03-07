"""
pdf_search.py — Fast keyword search across the 459 esoteric PDF corpus.

Usage:
    python pdf_search.py "Ficino Neoplatonism" --top 5
    python pdf_search.py "alchemy calcination" --top 8 --rebuild-index

The index is cached to pdf_index_cache.json on first build (~2 min for 459 PDFs).
Subsequent runs load from cache instantly.
"""
import json
import os
import re
import sys
import argparse
from pathlib import Path
from collections import defaultdict
from typing import List, Dict, Any

PDF_DIR   = Path(__file__).parent
CACHE_FILE = PDF_DIR / "pdf_index_cache.json"
MAX_PAGE_CHARS = 3000   # chars extracted per page (truncated)
SNIPPET_CONTEXT = 400   # chars around a match to return as snippet

# ── Text extraction ────────────────────────────────────────────────────────────

def extract_pdf_text(pdf_path: Path) -> List[Dict[str, Any]]:
    """Return list of {page, text} dicts for every page in the PDF."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(str(pdf_path))
        pages = []
        for i, page in enumerate(doc):
            text = page.get_text("text")[:MAX_PAGE_CHARS]
            if text.strip():
                pages.append({"page": i + 1, "text": text})
        doc.close()
        return pages
    except Exception as e:
        print(f"  [warn] {pdf_path.name}: {e}", file=sys.stderr)
        return []

# ── Index build ────────────────────────────────────────────────────────────────

def build_index(pdf_dir: Path = PDF_DIR, force: bool = False) -> Dict[str, Any]:
    """
    Build (or load from cache) a mapping of
    { filename -> { "path": str, "pages": [{page, text}] } }
    """
    if not force and CACHE_FILE.exists():
        print(f"Loading PDF index from {CACHE_FILE.name} ...", file=sys.stderr)
        with open(CACHE_FILE, encoding="utf-8") as f:
            return json.load(f)

    print(f"Building PDF index for {pdf_dir} ...", file=sys.stderr)
    index = {}
    pdfs = sorted(pdf_dir.rglob("*.pdf"))
    # Filter out node_modules / .venv etc.
    pdfs = [p for p in pdfs if not any(
        part in p.parts for part in ("node_modules", ".venv", "dist", "build")
    )]
    print(f"  Found {len(pdfs)} PDFs", file=sys.stderr)

    for i, pdf_path in enumerate(pdfs):
        rel = str(pdf_path.relative_to(pdf_dir))
        pages = extract_pdf_text(pdf_path)
        index[rel] = {"path": str(pdf_path), "pages": pages}
        if (i + 1) % 50 == 0:
            print(f"  Indexed {i + 1}/{len(pdfs)} ...", file=sys.stderr)

    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Index saved to {CACHE_FILE.name} ({CACHE_FILE.stat().st_size // 1024} KB)", file=sys.stderr)
    return index

# ── Search ─────────────────────────────────────────────────────────────────────

def _score_page(text: str, terms: List[str]) -> float:
    """Simple TF score: count of term occurrences, case-insensitive."""
    text_lower = text.lower()
    score = 0.0
    for term in terms:
        count = text_lower.count(term.lower())
        score += count * (2.0 if len(term) > 8 else 1.0)   # longer terms worth more
    return score

def _snippet(text: str, terms: List[str], context: int = SNIPPET_CONTEXT) -> str:
    """Return a snippet centred on the first matching term."""
    text_lower = text.lower()
    best_pos = len(text)
    for term in terms:
        pos = text_lower.find(term.lower())
        if 0 <= pos < best_pos:
            best_pos = pos
    if best_pos == len(text):
        return text[:context * 2].strip()
    start = max(0, best_pos - context // 2)
    end   = min(len(text), best_pos + context)
    snippet = text[start:end].strip()
    if start > 0:
        snippet = "…" + snippet
    if end < len(text):
        snippet = snippet + "…"
    return snippet

def search(
    query: str,
    index: Dict[str, Any],
    top: int = 5,
    min_score: float = 1.0,
) -> List[Dict[str, Any]]:
    """
    Search the index for query terms.
    Returns list of {filename, page, score, snippet} dicts, sorted by score desc.
    """
    # Tokenise query: keep multi-word phrases in quotes, otherwise split
    phrase_re = re.compile(r'"([^"]+)"|(\S+)')
    terms = []
    for m in phrase_re.finditer(query):
        terms.append(m.group(1) or m.group(2))

    results = []
    for filename, entry in index.items():
        for page_entry in entry["pages"]:
            score = _score_page(page_entry["text"], terms)
            if score >= min_score:
                results.append({
                    "filename": filename,
                    "page": page_entry["page"],
                    "score": score,
                    "snippet": _snippet(page_entry["text"], terms),
                })

    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:top]

# ── Public API used by gemini_writer.py ───────────────────────────────────────

def get_pdf_context(query: str, top: int = 5, rebuild: bool = False) -> str:
    """
    Returns a formatted string of top-N PDF passages for injection into a Gemini prompt.
    """
    index = build_index(force=rebuild)
    hits  = search(query, index, top=top)
    if not hits:
        return ""
    lines = ["### PDF Source Passages\n"]
    for h in hits:
        lines.append(f"**{Path(h['filename']).stem}** (p. {h['page']}, score {h['score']:.1f})")
        lines.append(h["snippet"])
        lines.append("")
    return "\n".join(lines)

# ── CLI ────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Search the esoteric PDF corpus")
    parser.add_argument("query", help="Search query (put phrases in quotes)")
    parser.add_argument("--top",           type=int,  default=5)
    parser.add_argument("--rebuild-index", action="store_true")
    parser.add_argument("--json",          action="store_true", help="Output raw JSON")
    args = parser.parse_args()

    index = build_index(force=args.rebuild_index)
    results = search(args.query, index, top=args.top)

    if args.json:
        print(json.dumps(results, indent=2, ensure_ascii=False))
    else:
        for r in results:
            print(f"\n{'='*60}")
            print(f"FILE:  {r['filename']}")
            print(f"PAGE:  {r['page']}   SCORE: {r['score']:.1f}")
            print(f"SNIPPET:\n{r['snippet']}")
