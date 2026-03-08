"""
ollama_writer.py — Use your LOCAL Ollama model (no API key needed) to search
your chats and PDFs and produce improved dictionary/encyclopedia entries.

This is the offline alternative to gemini_writer.py.
Use this while the Gemini free-tier resets, or any time you want a fast,
private, no-cost improvement pass.

REQUIREMENTS:
    Ollama must be running:   ollama serve
    Model must be pulled:     ollama pull qwen2.5:14b

USAGE:
    # Single entity
    python ollama_writer.py entity thinker_ficino

    # All entities (recommended first run)
    python ollama_writer.py entity --all

    # All topics
    python ollama_writer.py topic --all

    # All timeline events
    python ollama_writer.py timeline --all

    # Use a lighter/faster model
    python ollama_writer.py entity --all --model qwen2.5:7b

    # After reviewing output:
    python patch_entries.py --dry-run
    python patch_entries.py

Output: writing_output/entities/*.json, topics/*.json, timelines/*.json
"""

import os
import sys
import json
import sqlite3
import argparse
import re
import time
import httpx
from pathlib import Path
from typing import Optional, List, Dict, Any

# Force UTF-8 output on Windows to handle non-ASCII entity labels
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT           = Path(__file__).parent
DB_PATH        = ROOT / "esoteric_archive.db"
DATA_DIR       = ROOT / "cs-magical-scholarship" / "public" / "data"
OUTPUT_DIR     = ROOT / "writing_output"
ENTITIES_FILE  = DATA_DIR / "entities.json"
TOPICS_FILE    = DATA_DIR / "topics.json"
TIMELINES_FILE = DATA_DIR / "timelines.json"

OUTPUT_DIR.mkdir(exist_ok=True)
(OUTPUT_DIR / "entities").mkdir(exist_ok=True)
(OUTPUT_DIR / "topics").mkdir(exist_ok=True)
(OUTPUT_DIR / "timelines").mkdir(exist_ok=True)

OLLAMA_BASE    = "http://localhost:11434"
DEFAULT_MODEL  = "qwen2.5:14b"

# ── Ollama call ────────────────────────────────────────────────────────────────

def check_ollama() -> tuple[bool, list[str]]:
    """Check if Ollama is running and return available models."""
    try:
        r = httpx.get(f"{OLLAMA_BASE}/api/tags", timeout=3)
        data = r.json()
        models = [m['name'] for m in data.get('models', [])]
        return True, models
    except Exception:
        return False, []

def call_ollama(prompt: str, model: str = DEFAULT_MODEL, temperature: float = 0.3) -> str:
    """
    Call the Ollama /api/generate endpoint (non-streaming).
    Returns the full response text.
    """
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_ctx": 8192,   # context window
        },
        "format": "json",     # request JSON output
    }
    try:
        r = httpx.post(
            f"{OLLAMA_BASE}/api/generate",
            json=payload,
            timeout=180,  # 3 min timeout for large contexts
        )
        r.raise_for_status()
        data = r.json()
        return data.get("response", "")
    except httpx.TimeoutException:
        raise RuntimeError("Ollama request timed out (>3 min). Try a smaller context or faster model.")
    except Exception as e:
        raise RuntimeError(f"Ollama error: {e}")

# ── Context retrieval (same as gemini_writer.py) ───────────────────────────────

def get_chat_context(query: str, limit: int = 10) -> str:
    if not DB_PATH.exists():
        return "(archive database not found)"
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    fts_q = query.replace("'", "''").replace(".", " ").replace(",", " ").replace("?", " ")
    rows = []
    try:
        rows = conn.execute("""
            SELECT c.title, t.role, t.content, bm25(turns_fts) AS score
            FROM turns t
            JOIN turns_fts f ON t.id = f.rowid
            JOIN conversations c ON t.conversation_id = c.id
            WHERE turns_fts MATCH ?
              AND t.role != 'tool'
              AND length(t.content) > 100
            ORDER BY score
            LIMIT ?
        """, (fts_q, limit)).fetchall()
    except sqlite3.Error as e:
        print(f"  [FTS warn] {e}", file=sys.stderr)
    conn.close()
    if not rows:
        return ""
    lines = [f"### Archive (top {len(rows)} relevant turns)\n"]
    for r in rows:
        role = r["role"].upper()
        title = r["title"] or "(untitled)"
        content = (r["content"] or "")[:600]
        lines.append(f"[{title}] {role}: {content}")
        lines.append("")
    return "\n".join(lines)

def get_pdf_context(query: str, top: int = 3) -> str:
    try:
        from pdf_search import get_pdf_context as _pdf_ctx
        return _pdf_ctx(query, top=top)
    except Exception as e:
        print(f"  [PDF warn] {e}", file=sys.stderr)
        return ""

# ── Prompt builders ────────────────────────────────────────────────────────────

DICT_STYLE = """You are a scholarly editor writing entries for a digital encyclopedia of Western esotericism, modeled on the Dictionary of Gnosis and Western Esotericism (Brill, 2006). Entries cover scholars, historical figures, primary texts, movements, concepts, and practices across Neoplatonism, Hermeticism, alchemy, Kabbalah, Renaissance magic, Rosicrucianism, Theosophy, and Islamic esotericism.

WRITING STANDARDS:
- Academic but accessible prose, suitable for a graduate-level reference work
- Specific: cite exact texts (with dates), doctrines, historical contexts, and scholarly debates
- Both biographical dimension AND intellectual/doctrinal content for thinker entries
- Reception history: how was this figure/text received, transmitted, revived?
- Scholarly framing: reference key secondary sources and debates where relevant
- No bullet points or lists in the prose body
- No em-dashes (use commas or semicolons instead)
- Avoid vague superlatives ("great", "important"); be specific about WHY something matters

OUTPUT: Return a valid JSON object matching the schema in the prompt. No markdown fencing. Pure JSON."""

def build_entity_prompt(entity: Dict, chat_ctx: str, pdf_ctx: str) -> str:
    eid    = entity["id"]
    label  = entity["label"]
    etype  = entity["type"]
    aliases = ", ".join(entity.get("aliases", []))
    tags   = ", ".join(entity.get("tags", []))
    current_blurb = entity.get("blurb", "")

    return f"""{DICT_STYLE}

## TARGET ENTRY

- ID: {eid}
- Type: {etype}
- Name: {label}
- Aliases: {aliases}
- Tradition tags: {tags}
- Current short blurb (to improve): {current_blurb}

## SOURCE MATERIAL

{chat_ctx}

{pdf_ctx}

## TASK

Write a dictionary/encyclopedia entry for **{label}** suitable for a graduate-level reference work on Western esotericism. Use the source material above as context and evidence.

Return this exact JSON structure (no markdown, no fences):

{{
  "id": "{eid}",
  "blurb": "One dense paragraph, 60-80 words. Dates, tradition, defining contributions. Written as a reference-work headnote.",
  "blurb_long": "Three to five paragraphs, 400-600 words total. Structure: (1) biographical/historical context and formation; (2) key doctrines, texts, and intellectual contributions with specific titles and dates; (3) relationship to the esoteric tradition — what makes this entry belong in an esotericism encyclopedia; (4) historical reception, transmission, and revival; (5) current scholarly debates and open questions. No bullets.",
  "tags": ["tag1", "tag2"],
  "connections": ["entity_id_1", "entity_id_2"],
  "open_questions": "1-2 sentences on what remains contested or understudied in current scholarship on this figure/text."
}}

For connections, use only IDs from: thinker_ficino, thinker_pico, thinker_plotinus, thinker_proclus, thinker_ikhwan, thinker_iamblichus, thinker_porphyry, thinker_pseudo_dionysius, thinker_agrippa, thinker_paracelsus, thinker_bruno, thinker_dee, thinker_fludd, thinker_kircher, thinker_albertus, thinker_pythagoras, thinker_plato, thinker_aristotle, thinker_hermes, thinker_ibn_sina, thinker_ibn_rushd, thinker_al_farabi

Tags (3-8, lowercase): neoplatonism, alchemy, kabbalah, hermeticism, renaissance, islamic, gnosticism, theurgy, magic, astrology, medicine, theology, philosophy, translation, synthesis, christianity, mysticism, sufism, mathematics, cosmology, angelology, demonology, rosicrucian
"""

def build_topic_prompt(topic: Dict, chat_ctx: str, pdf_ctx: str) -> str:
    name = topic["name"]
    rank = topic["rank"]
    current_what = topic.get("what_it_is", "")
    current_studied = topic.get("what_studied", "")
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")

    return f"""{DICT_STYLE}

## TARGET TOPIC

- Name: {name}
- Rank in study archive: #{rank} of 50 most-studied topics
- Current what_it_is: {current_what[:300] if current_what else '(empty)'}
- Current what_studied summary: {current_studied[:300] if current_studied else '(empty)'}

## SOURCE MATERIAL

{chat_ctx}

{pdf_ctx}

## TASK

Write an improved entry for the topic **{name}** as a structured study-guide entry for an esoteric studies research portal.

Return this exact JSON (no markdown, no fences):

{{
  "name": "{name}",
  "slug": "{slug}",
  "what_it_is": "2-4 sentences, 80-120 words. Precise scholarly definition: what is this topic in the history of Western esotericism? Name key periods, figures, and characteristics.",
  "what_studied": "4-6 sentences, 150-250 words. What specific aspects, texts, debates, figures, and questions appeared in the research archive conversations? Be precise and scholarly, citing actual texts and thinkers discussed.",
  "connections": ["RelatedTopic1", "RelatedTopic2", "RelatedTopic3"],
  "open_questions": "3-5 sentences, 80-130 words. What genuine scholarly debates or unresolved questions exist for this topic? Reference real debates where possible.",
  "key_figures": ["Name1", "Name2", "Name3"],
  "key_texts": ["Title (date/century)", "Title (date/century)"],
  "key_scholars": ["ModernScholar1 (year)", "ModernScholar2 (year)"]
}}
"""

def build_timeline_prompt(event: Dict, timeline_name: str, chat_ctx: str, pdf_ctx: str) -> str:
    eid     = event.get("id", "")
    title   = event.get("title", "")
    start   = event.get("start", "")
    current = event.get("description_md", "")
    related = event.get("related_entities", [])
    tags    = event.get("tags", [])

    return f"""{DICT_STYLE}

## TIMELINE EVENT

- Timeline: {timeline_name}
- Event ID: {eid}
- Title: {title}
- Date: {start}
- Related entities: {related}
- Tags: {tags}
- Current description: {current}

## SOURCE MATERIAL

{chat_ctx}

{pdf_ctx}

## TASK

Write an expanded timeline event description for a history-of-esotericism chronology.

Return this exact JSON (no markdown, no fences):

{{
  "id": "{eid}",
  "description_md": "2-3 paragraphs, 150-300 words total. Markdown: **bold** for names/titles, *italic* for text titles. Paragraph 1: what happened and its immediate historical context. Paragraph 2: its significance for the esoteric tradition specifically. Optional paragraph 3: its reception, later influence, or scholarly debate.",
  "citations": [
    {{"source": "PDF filename or conversation title", "note": "what this source says about the event"}}
  ]
}}
"""

# ── Processing functions ───────────────────────────────────────────────────────

def load_entities() -> List[Dict]:
    with open(ENTITIES_FILE, encoding="utf-8") as f:
        return json.load(f)

def load_topics() -> List[Dict]:
    with open(TOPICS_FILE, encoding="utf-8") as f:
        return json.load(f)

def load_timelines() -> List[Dict]:
    with open(TIMELINES_FILE, encoding="utf-8") as f:
        return json.load(f)

def process_entity(entity: Dict, model: str, force: bool) -> Optional[Dict]:
    eid   = entity["id"]
    label = entity["label"]
    out   = OUTPUT_DIR / "entities" / f"{eid}.json"
    if out.exists() and not force:
        print(f"  [skip] {eid}")
        return None

    print(f"  {label} ({eid})")
    aliases = entity.get("aliases", [])
    query   = " ".join([label] + aliases[:2])
    chat    = get_chat_context(query, limit=10)
    pdf     = get_pdf_context(query, top=3)
    prompt  = build_entity_prompt(entity, chat, pdf)

    raw = call_ollama(prompt, model=model)
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        # Try to extract JSON from response
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            result = json.loads(m.group())
        else:
            raise ValueError(f"Could not parse JSON from response: {raw[:200]}")

    result["_source_entity"] = eid
    result["_model"] = model
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    blurb_wc = len(result.get("blurb", "").split())
    long_wc  = len(result.get("blurb_long", "").split())
    print(f"    blurb={blurb_wc}w  blurb_long={long_wc}w")
    return result

def process_topic(topic: Dict, model: str, force: bool) -> Optional[Dict]:
    name = topic["name"]
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    out  = OUTPUT_DIR / "topics" / f"{slug}.json"
    if out.exists() and not force:
        print(f"  [skip] {name}")
        return None

    print(f"  {name}")
    chat   = get_chat_context(name, limit=10)
    pdf    = get_pdf_context(name, top=3)
    prompt = build_topic_prompt(topic, chat, pdf)

    raw = call_ollama(prompt, model=model)
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            result = json.loads(m.group())
        else:
            raise ValueError(f"Could not parse JSON: {raw[:200]}")

    result["_source_name"] = name
    result["_model"] = model
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"    what_it_is={len(result.get('what_it_is','').split())}w")
    return result

def process_timeline_event(event: Dict, timeline_name: str, model: str, force: bool) -> Optional[Dict]:
    eid   = event.get("id", "")
    title = event.get("title", "")
    out   = OUTPUT_DIR / "timelines" / f"{eid}.json"
    if out.exists() and not force:
        print(f"  [skip] {eid}")
        return None

    print(f"  {title} ({eid})")
    query  = f"{title} {' '.join(event.get('related_entities', []))}"
    chat   = get_chat_context(query, limit=8)
    pdf    = get_pdf_context(query, top=2)
    prompt = build_timeline_prompt(event, timeline_name, chat, pdf)

    raw = call_ollama(prompt, model=model)
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            result = json.loads(m.group())
        else:
            raise ValueError(f"Could not parse JSON: {raw[:200]}")

    result["_source_event"] = eid
    result["_model"] = model
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"    desc={len(result.get('description_md','').split())}w")
    return result

# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Ollama-powered encyclopedia entry writer for EsoPipe"
    )
    parser.add_argument("mode", choices=["entity", "topic", "timeline"])
    parser.add_argument("target", nargs="?", default=None)
    parser.add_argument("--all",         action="store_true")
    parser.add_argument("--force",       action="store_true")
    parser.add_argument("--model",       default=DEFAULT_MODEL)
    parser.add_argument("--delay",       type=float, default=1.0,
                        help="Seconds between requests (avoids GPU overload)")
    parser.add_argument("--timeline-id", default=None)
    args = parser.parse_args()

    # Check Ollama
    running, models = check_ollama()
    if not running:
        sys.exit(
            "ERROR: Ollama is not running.\n"
            "Start it with:  ollama serve\n"
            "Then pull the model:  ollama pull qwen2.5:14b"
        )
    if args.model not in models and models:
        print(f"Warning: model '{args.model}' not found. Available: {models}")
        if models:
            print(f"Using first available: {models[0]}")
            args.model = models[0]
    print(f"Ollama running. Model: {args.model}")
    print(f"Available models: {models}\n")

    errors = []

    if args.mode == "entity":
        entities = load_entities()
        targets = entities if args.all else [
            e for e in entities if e["id"] == args.target
        ]
        if not targets:
            sys.exit(f"Entity '{args.target}' not found.")
        print(f"Processing {len(targets)} entities...\n")
        for i, e in enumerate(targets):
            try:
                process_entity(e, model=args.model, force=args.force)
            except Exception as ex:
                print(f"  ERROR: {ex}", file=sys.stderr)
                errors.append((e["id"], str(ex)))
            if i < len(targets) - 1:
                time.sleep(args.delay)

    elif args.mode == "topic":
        topics = load_topics()
        targets = topics if args.all else [
            t for t in topics if t["name"].lower() == (args.target or "").lower()
        ]
        if not targets:
            sys.exit(f"Topic '{args.target}' not found.")
        print(f"Processing {len(targets)} topics...\n")
        for i, t in enumerate(targets):
            try:
                process_topic(t, model=args.model, force=args.force)
            except Exception as ex:
                print(f"  ERROR: {ex}", file=sys.stderr)
                errors.append((t["name"], str(ex)))
            if i < len(targets) - 1:
                time.sleep(args.delay)

    elif args.mode == "timeline":
        timelines = load_timelines()
        events = []
        for tl in timelines:
            if args.timeline_id and tl.get("timeline_id") != args.timeline_id:
                continue
            for ev in tl.get("events", []):
                if not args.all and args.target and ev.get("id") != args.target:
                    continue
                events.append((ev, tl.get("title", "")))
        if not events:
            sys.exit("No matching timeline events.")
        print(f"Processing {len(events)} timeline events...\n")
        for i, (ev, tl_name) in enumerate(events):
            try:
                process_timeline_event(ev, tl_name, model=args.model, force=args.force)
            except Exception as ex:
                print(f"  ERROR: {ex}", file=sys.stderr)
                errors.append((ev.get("id"), str(ex)))
            if i < len(events) - 1:
                time.sleep(args.delay)

    print(f"\nDone. {len(errors)} errors.")
    if errors:
        for eid, msg in errors:
            print(f"  FAILED {eid}: {msg}")
    print("\nReview writing_output/ then run: python patch_entries.py")

if __name__ == "__main__":
    main()
