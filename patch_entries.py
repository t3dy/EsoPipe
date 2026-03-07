"""
patch_entries.py — Merge Gemini writing_output/ files back into the main JSON data files.

USAGE:
    python patch_entries.py --dry-run     # Preview changes without writing
    python patch_entries.py               # Apply all patches
    python patch_entries.py --mode entity # Only patch entities
    python patch_entries.py --mode topic  # Only patch topics
    python patch_entries.py --mode timeline # Only patch timelines

VALIDATION:
    - Blurbs: 100-250 words
    - blurb_long: 300-600 words
    - No em-dashes (auto-removed)
    - Required fields present
    - No [PLACEHOLDER] strings
"""

import json
import re
import sys
import argparse
from pathlib import Path
from typing import List, Dict, Any, Tuple

ROOT           = Path(__file__).parent
DATA_DIR       = ROOT / "cs-magical-scholarship" / "public" / "data"
OUTPUT_DIR     = ROOT / "writing_output"
ENTITIES_FILE  = DATA_DIR / "entities.json"
TOPICS_FILE    = DATA_DIR / "topics.json"
TIMELINES_FILE = DATA_DIR / "timelines.json"

DISALLOWED = ["[PLACEHOLDER]", "[INSERT]", "TODO", "FIXME", "lorem ipsum"]

# ── Validators ─────────────────────────────────────────────────────────────────

def word_count(text: str) -> int:
    return len(text.split())

def clean_text(text: str) -> str:
    """Remove em-dashes, strip excess whitespace."""
    text = text.replace("—", ", ").replace("–", "-")
    text = re.sub(r"\s{3,}", " ", text)
    return text.strip()

def validate_text(text: str, field: str, min_words: int = 0, max_words: int = 9999) -> List[str]:
    errors = []
    wc = word_count(text)
    if wc < min_words:
        errors.append(f"{field}: too short ({wc} words, min {min_words})")
    if wc > max_words:
        errors.append(f"{field}: too long ({wc} words, max {max_words})")
    for bad in DISALLOWED:
        if bad.lower() in text.lower():
            errors.append(f"{field}: contains disallowed string '{bad}'")
    return errors

def validate_entity_output(data: Dict) -> Tuple[bool, List[str]]:
    errors = []
    if "blurb" not in data:
        errors.append("missing field: blurb")
    else:
        errors += validate_text(data["blurb"], "blurb", min_words=100, max_words=260)
    if "blurb_long" in data:
        errors += validate_text(data["blurb_long"], "blurb_long", min_words=250, max_words=650)
    return len(errors) == 0, errors

def validate_topic_output(data: Dict) -> Tuple[bool, List[str]]:
    errors = []
    for field in ["what_it_is", "what_studied"]:
        if field not in data:
            errors.append(f"missing field: {field}")
        else:
            errors += validate_text(data[field], field, min_words=40)
    return len(errors) == 0, errors

def validate_timeline_output(data: Dict) -> Tuple[bool, List[str]]:
    errors = []
    if "description_md" not in data:
        errors.append("missing field: description_md")
    else:
        errors += validate_text(data["description_md"], "description_md", min_words=80, max_words=400)
    return len(errors) == 0, errors

# ── Patch functions ────────────────────────────────────────────────────────────

def patch_entities(dry_run: bool = False) -> int:
    out_files = list((OUTPUT_DIR / "entities").glob("*.json"))
    if not out_files:
        print("  No entity output files found.")
        return 0

    with open(ENTITIES_FILE, encoding="utf-8") as f:
        entities = json.load(f)
    ent_map = {e["id"]: e for e in entities}

    patched = 0
    for out_file in sorted(out_files):
        with open(out_file, encoding="utf-8") as f:
            data = json.load(f)

        eid = data.get("_source_entity") or data.get("id")
        if not eid or eid not in ent_map:
            print(f"  [warn] {out_file.name}: entity ID '{eid}' not found in entities.json")
            continue

        ok, errors = validate_entity_output(data)
        if not ok:
            print(f"  [FAIL] {eid}: {'; '.join(errors)}")
            continue

        # Apply patch
        entity = ent_map[eid]
        if "blurb" in data:
            entity["blurb"] = clean_text(data["blurb"])
        if "blurb_long" in data:
            entity["blurb_long"] = clean_text(data["blurb_long"])
        if "tags" in data and isinstance(data["tags"], list):
            entity["tags"] = data["tags"]
        if "connections" in data:
            entity["connections"] = data["connections"]
        if "open_questions" in data:
            entity["open_questions"] = clean_text(data["open_questions"])

        status = "[dry-run]" if dry_run else "[patched]"
        print(f"  {status} {eid}: blurb={word_count(entity.get('blurb',''))}w")
        patched += 1

    if not dry_run and patched:
        with open(ENTITIES_FILE, "w", encoding="utf-8") as f:
            json.dump(list(ent_map.values()), f, indent=2, ensure_ascii=False)
        print(f"  Wrote {ENTITIES_FILE.name} ({patched} entities updated)")

    return patched

def patch_topics(dry_run: bool = False) -> int:
    out_files = list((OUTPUT_DIR / "topics").glob("*.json"))
    if not out_files:
        print("  No topic output files found.")
        return 0

    with open(TOPICS_FILE, encoding="utf-8") as f:
        topics = json.load(f)
    topic_map = {t["name"].lower(): t for t in topics}

    patched = 0
    for out_file in sorted(out_files):
        with open(out_file, encoding="utf-8") as f:
            data = json.load(f)

        name = data.get("_source_name") or data.get("name")
        if not name or name.lower() not in topic_map:
            print(f"  [warn] {out_file.name}: topic '{name}' not found in topics.json")
            continue

        ok, errors = validate_topic_output(data)
        if not ok:
            print(f"  [FAIL] {name}: {'; '.join(errors)}")
            continue

        topic = topic_map[name.lower()]
        for field in ["what_it_is", "what_studied", "connections", "open_questions",
                      "key_figures", "key_texts"]:
            if field in data and data[field]:
                if isinstance(data[field], str):
                    topic[field] = clean_text(data[field])
                else:
                    topic[field] = data[field]

        status = "[dry-run]" if dry_run else "[patched]"
        print(f"  {status} {name}: what_it_is={word_count(topic.get('what_it_is',''))}w")
        patched += 1

    if not dry_run and patched:
        with open(TOPICS_FILE, "w", encoding="utf-8") as f:
            json.dump(topics, f, indent=2, ensure_ascii=False)
        print(f"  Wrote {TOPICS_FILE.name} ({patched} topics updated)")

    return patched

def patch_timelines(dry_run: bool = False) -> int:
    out_files = list((OUTPUT_DIR / "timelines").glob("*.json"))
    if not out_files:
        print("  No timeline event output files found.")
        return 0

    with open(TIMELINES_FILE, encoding="utf-8") as f:
        timelines = json.load(f)

    # Build flat event map
    event_map = {}
    for tl in timelines:
        for event in tl.get("events", []):
            event_map[event["id"]] = event

    patched = 0
    for out_file in sorted(out_files):
        with open(out_file, encoding="utf-8") as f:
            data = json.load(f)

        eid = data.get("_source_event") or data.get("id")
        if not eid or eid not in event_map:
            print(f"  [warn] {out_file.name}: event '{eid}' not found")
            continue

        ok, errors = validate_timeline_output(data)
        if not ok:
            print(f"  [FAIL] {eid}: {'; '.join(errors)}")
            continue

        event = event_map[eid]
        if "description_md" in data:
            event["description_md"] = clean_text(data["description_md"])
        if "citations" in data and isinstance(data["citations"], list):
            event["citations"] = data["citations"]

        status = "[dry-run]" if dry_run else "[patched]"
        print(f"  {status} {eid}: desc={word_count(event.get('description_md',''))}w")
        patched += 1

    if not dry_run and patched:
        with open(TIMELINES_FILE, "w", encoding="utf-8") as f:
            json.dump(timelines, f, indent=2, ensure_ascii=False)
        print(f"  Wrote {TIMELINES_FILE.name} ({patched} events updated)")

    return patched

# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Patch JSON data files with Gemini writing output")
    parser.add_argument("--dry-run",  action="store_true", help="Show what would change without writing")
    parser.add_argument("--mode",     choices=["entity", "topic", "timeline", "all"], default="all")
    args = parser.parse_args()

    dr = args.dry_run
    if dr:
        print("DRY RUN — no files will be written\n")

    total = 0
    if args.mode in ("entity", "all"):
        print("=== Entities ===")
        total += patch_entities(dry_run=dr)
    if args.mode in ("topic", "all"):
        print("\n=== Topics ===")
        total += patch_topics(dry_run=dr)
    if args.mode in ("timeline", "all"):
        print("\n=== Timeline Events ===")
        total += patch_timelines(dry_run=dr)

    print(f"\nTotal patched: {total}")
    if dr:
        print("Re-run without --dry-run to apply changes.")
    else:
        print("Run: cd cs-magical-scholarship && npm run build:desktop")
        print("Then: python -m PyInstaller 'EsoPipe Studio.spec' --noconfirm --distpath '%TEMP%\\esopipe_dist'")

if __name__ == "__main__":
    main()
