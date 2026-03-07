"""
pdf_sort.py — Categorise the 459 PDFs into three buckets and produce
a JSON manifest used by the writing pipeline to filter source material.

CATEGORIES:
    scholarly   — modern academic books, articles, theses
    primary     — pre-modern primary source translations and editions
    generated   — AI-generated summaries / my own documents (lower weight)
    exclude     — off-topic or irrelevant

USAGE:
    python pdf_sort.py               # run categorisation, print + save manifest
    python pdf_sort.py --show        # print manifest without re-scanning
    python pdf_sort.py --interactive # manually reclassify uncertain files

OUTPUT:
    pdf_manifest.json — {filename: {category, reason, path}}
"""

import json
import re
import sys
from pathlib import Path
from typing import Dict, Tuple
import argparse

ROOT    = Path(__file__).parent
MANIFEST_FILE = ROOT / "pdf_manifest.json"

# ── Known modern esoteric scholars (secondary sources) ───────────────────────
KNOWN_SCHOLARS = {
    "hanegraaff", "faivre", "wouter", "ebeling", "versluis", "godwin",
    "debus", "newman", "principe", "nummedal", "moran", "vickers",
    "yates", "frances", "walker", "copenhaver", "kristeller", "cassirer",
    "klibansky", "panofsky", "saxl", "garin", "trinkaus", "secret",
    "scholem", "idel", "moshe", "wolfson", "sendor", "matt", "tishby",
    "corbin", "henry", "nasr", "seyyed", "nasr", "ridgeon", "radtke",
    "gardiner", "weller", "harkness", "french", "macfarlane",
    "shumaker", "thorndike", "burnett", "charles", "matus", "coudert",
    "lachman", "gary", "churton", "tobias", "luhrmann", "bogdan",
    "pasi", "marco", "asprem", "egil", "hammer", "olav", "stausberg",
    "york", "michael", "partridge", "christopher", "granholm",
    "kripal", "jeffrey", "taylor", "charles", "goodrick_clarke",
    "godwin", "joscelyn", "whitmore", "benoist", "rhodes",
    "forshaw", "peter", "tilton", "hereward", "mclean", "adam",
    "smoley", "richard", "katz", "leet",
}

# ── Patterns indicating AI-generated or personal documents ───────────────────
GENERATED_PATTERNS = [
    r"overview$",
    r"summary$",
    r"introduction$",
    r"notes$",
    r"outline$",
    r"and[a-z]+influence",
    r"and[a-z]+comparison",
    r"and[a-z]+connection",
    r"and[a-z]+relationship",
    r"and[a-z]+relevance",
    r"and[a-z]+themes",
    r"and[a-z]+tradition",
    r"and[a-z]+magic",
    r"and[a-z]+philosophy",
    r"and[a-z]+mysticism",
    r"ideas$",
    r"reflections$",
    r"puzzle",
    r"discussion",
    r"lesson\d",
    r"\d+questions",
]

# ── Off-topic patterns (exclude from esoteric search) ─────────────────────────
EXCLUDE_PATTERNS = [
    r"firesign",
    r"mondo2000",
    r"rv.?trip",
    r"invoice",
    r"receipt",
    r"sms",
    r"business",
    r"melancholy.*eighteenth",
    r"henry.?vaughan",
    r"eighteenth.?century",
]

# ── Primary source indicators ─────────────────────────────────────────────────
PRIMARY_PATTERNS = [
    r"^agrippa\b",
    r"^ficino\b",
    r"^plotinus\b",
    r"^proclus\b",
    r"^paracelsus\b",
    r"^dee\b",
    r"^bruno\b",
    r"^kircher\b",
    r"^fludd\b",
    r"^iamblichus\b",
    r"^porphyry\b",
    r"^corpus.?hermeticum",
    r"^hermetica\b",
    r"^picatrix\b",
    r"^sefer",
    r"^zohar\b",
    r"^enneads\b",
    r"^elements.?of.?theology",
    r"^de.?vita",
    r"^de.?occulta",
    r"^asclepius\b",
    r"^oration.?on.?dignity",
    r"^nine.?hundred.?theses",
    r"^emerald.?tablet",
    r"^splendor.?solis",
    r"^rosarium\b",
    r"^monas.?hieroglyphica",
    r"^amphitheatrum\b",
]

def classify_pdf(name_stem: str) -> Tuple[str, str]:
    """
    Classify a PDF by its filename stem.
    Returns (category, reason).
    """
    s = name_stem.lower()
    s_nospace = re.sub(r"[^a-z0-9]", "", s)

    # 1. Exclude off-topic
    for pat in EXCLUDE_PATTERNS:
        if re.search(pat, s):
            return "exclude", f"matches off-topic pattern: {pat}"

    # 2. AI-generated / personal
    for pat in GENERATED_PATTERNS:
        if re.search(pat, s_nospace):
            return "generated", f"filename pattern suggests AI-generated: {pat}"

    # 3. Primary sources
    for pat in PRIMARY_PATTERNS:
        if re.search(pat, s):
            return "primary", f"filename matches primary source: {pat}"

    # 4. Scholarly (author surname in filename)
    for scholar in KNOWN_SCHOLARS:
        if scholar in s_nospace:
            return "scholarly", f"known scholar in filename: {scholar}"

    # 5. Thesis / dissertation markers
    if any(k in s for k in ("thesis", "dissertation", "phd", "diss")):
        return "scholarly", "thesis or dissertation"

    # 6. Numeric suffix versions (e.g. Agrippa_1.pdf) — same as base
    # These were already handled in primary/generated above
    # Default: probably scholarly or primary, uncertain
    if any(k in s_nospace for k in (
        "history", "studies", "philosophy", "tradition", "religion",
        "magic", "alchemy", "kabbalah", "hermeticism", "neoplatonism",
        "mysticism", "occult", "esoteric", "hermetic", "astrology",
        "kabbalistic", "neoplatonic",
    )):
        return "scholarly", "title contains tradition keywords"

    return "uncertain", "could not auto-classify"

def build_manifest(pdf_dir: Path = ROOT) -> Dict:
    pdfs = sorted(pdf_dir.rglob("*.pdf"))
    pdfs = [p for p in pdfs if not any(
        part in p.parts for part in ("node_modules", ".venv", "dist", "build", "AlchemyDB")
    )]

    manifest = {}
    counts = {"scholarly": 0, "primary": 0, "generated": 0, "exclude": 0, "uncertain": 0}

    for p in pdfs:
        stem = p.stem
        category, reason = classify_pdf(stem)
        manifest[p.name] = {
            "category": category,
            "reason": reason,
            "path": str(p),
        }
        counts[category] = counts.get(category, 0) + 1

    manifest["__stats__"] = counts
    return manifest

def print_manifest(manifest: Dict, show_all: bool = False):
    stats = manifest.get("__stats__", {})
    print("\n=== PDF Corpus Classification ===")
    for cat, count in sorted(stats.items()):
        print(f"  {cat:12s}: {count:3d}")
    print()

    for category in ("uncertain", "exclude", "generated"):
        entries = [(k, v) for k, v in manifest.items()
                   if isinstance(v, dict) and v.get("category") == category]
        if entries:
            print(f"--- {category.upper()} ({len(entries)}) ---")
            for name, info in sorted(entries):
                print(f"  {name}")
                print(f"    reason: {info['reason']}")
            print()

    if show_all:
        for category in ("scholarly", "primary"):
            entries = [(k, v) for k, v in manifest.items()
                       if isinstance(v, dict) and v.get("category") == category]
            if entries:
                print(f"--- {category.upper()} ({len(entries)}) ---")
                for name, info in sorted(entries):
                    print(f"  {name}")
                print()

def reclassify_interactive(manifest: Dict) -> Dict:
    """Walk through uncertain entries and let the user reclassify."""
    uncertain = [(k, v) for k, v in manifest.items()
                 if isinstance(v, dict) and v.get("category") == "uncertain"]
    if not uncertain:
        print("No uncertain entries to reclassify.")
        return manifest

    print(f"\n{len(uncertain)} uncertain PDFs to classify.")
    print("Options: s=scholarly, p=primary, g=generated, e=exclude, ?=skip\n")

    CAT_MAP = {"s": "scholarly", "p": "primary", "g": "generated", "e": "exclude"}
    for name, info in uncertain:
        print(f"FILE: {name}")
        choice = input("  Category [s/p/g/e/?]: ").strip().lower()
        if choice in CAT_MAP:
            manifest[name]["category"] = CAT_MAP[choice]
            manifest[name]["reason"] = "manually classified"
    return manifest

def main():
    parser = argparse.ArgumentParser(description="Classify the esoteric PDF corpus")
    parser.add_argument("--show",        action="store_true", help="Show existing manifest")
    parser.add_argument("--show-all",    action="store_true", help="Show all categories")
    parser.add_argument("--interactive", action="store_true", help="Reclassify uncertain items")
    args = parser.parse_args()

    if args.show or args.show_all:
        if MANIFEST_FILE.exists():
            with open(MANIFEST_FILE, encoding="utf-8") as f:
                manifest = json.load(f)
            print_manifest(manifest, show_all=args.show_all)
        else:
            print("No manifest yet. Run without --show to build one.")
        return

    print("Scanning PDFs...")
    manifest = build_manifest()

    if args.interactive:
        manifest = reclassify_interactive(manifest)

    with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"Manifest saved to {MANIFEST_FILE.name}")
    print_manifest(manifest)

if __name__ == "__main__":
    main()
