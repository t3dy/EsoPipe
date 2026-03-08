"""
gemini_writer.py — Use the Gemini API to search your chats and PDFs and produce
improved entries for entities, topics, and timeline events.

SETUP:
    pip install google-generativeai python-dotenv   (both already installed)
    Make sure .env contains:  GEMINI_API_KEY=AIzaSy...

USAGE:
    # Improve a single entity blurb
    python gemini_writer.py entity thinker_ficino

    # Improve all entity blurbs
    python gemini_writer.py entity --all

    # Improve a single topic
    python gemini_writer.py topic "Neoplatonism"

    # Improve all topics
    python gemini_writer.py topic --all

    # Improve a single timeline event
    python gemini_writer.py timeline "plotinus_enneads" --timeline-id "neoplatonism"

    # Improve all timeline events
    python gemini_writer.py timeline --all

    # After reviewing output, patch the JSON files
    python patch_entries.py --dry-run
    python patch_entries.py

Output files go to:  writing_output/entities/{id}.json
                     writing_output/topics/{slug}.json
                     writing_output/timelines/{event_id}.json
"""

import os
import sys
import json
import sqlite3
import argparse
import re
import time
from pathlib import Path
from typing import Optional, List, Dict, Any

# Force UTF-8 output on Windows to handle non-ASCII entity labels
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# ── Load env ──────────────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    sys.exit("ERROR: GEMINI_API_KEY not set. Add it to .env or set the environment variable.")

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT          = Path(__file__).parent
DB_PATH       = ROOT / "esoteric_archive.db"
DATA_DIR      = ROOT / "cs-magical-scholarship" / "public" / "data"
OUTPUT_DIR    = ROOT / "writing_output"
ENTITIES_FILE = DATA_DIR / "entities.json"
TOPICS_FILE   = DATA_DIR / "topics.json"
TIMELINES_FILE = DATA_DIR / "timelines.json"

OUTPUT_DIR.mkdir(exist_ok=True)
(OUTPUT_DIR / "entities").mkdir(exist_ok=True)
(OUTPUT_DIR / "topics").mkdir(exist_ok=True)
(OUTPUT_DIR / "timelines").mkdir(exist_ok=True)

# ── Gemini setup ──────────────────────────────────────────────────────────────
from google import genai
from google.genai import types

_gemini_client = genai.Client(api_key=GEMINI_API_KEY)

# gemini-2.5-flash: free tier thinking model, excellent for scholarly writing
# gemini-2.0-flash: free tier but may have 0 quota on some accounts
DEFAULT_MODEL = "gemini-2.5-flash"

def call_gemini(prompt: str, model_name: str = DEFAULT_MODEL, temperature: float = 0.4) -> str:
    """Call the Gemini API and return the text response."""
    response = _gemini_client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=temperature,
            response_mime_type="application/json",  # structured JSON output
        ),
    )
    text = response.text or ""
    # Strip markdown code fences if model wraps JSON
    text = re.sub(r'^```(?:json)?\s*', '', text.strip())
    text = re.sub(r'\s*```$', '', text.strip())
    return text

# ── Chat retrieval ─────────────────────────────────────────────────────────────

def get_chat_context(query: str, limit: int = 15) -> str:
    """
    Pull the most relevant conversation turns from the SQLite archive
    using FTS5 full-text search. Returns a formatted string.
    """
    if not DB_PATH.exists():
        return "(archive database not found)"

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    fts_q = query.replace("'", "''").replace(".", " ").replace(",", " ").replace("?", " ")

    rows = []
    try:
        rows = conn.execute("""
            SELECT c.title, t.role, t.content, t.turn_index,
                   bm25(turns_fts) AS score
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

    lines = [f"### Archive Conversations (top {len(rows)} relevant turns)\n"]
    for r in rows:
        role = r["role"].upper()
        title = r["title"] or "(untitled)"
        content = (r["content"] or "")[:800]
        lines.append(f"**Conversation:** {title}")
        lines.append(f"**{role}:** {content}")
        lines.append("")
    return "\n".join(lines)

# ── PDF retrieval ──────────────────────────────────────────────────────────────

def get_pdf_context(query: str, top: int = 5) -> str:
    """Pull relevant PDF passages via pdf_search.py."""
    try:
        from pdf_search import get_pdf_context as _pdf_ctx
        return _pdf_ctx(query, top=top)
    except Exception as e:
        print(f"  [PDF warn] {e}", file=sys.stderr)
        return ""

# ── Load current data ──────────────────────────────────────────────────────────

def load_entities() -> List[Dict]:
    with open(ENTITIES_FILE, encoding="utf-8") as f:
        return json.load(f)

def load_topics() -> List[Dict]:
    with open(TOPICS_FILE, encoding="utf-8") as f:
        return json.load(f)

def load_timelines() -> List[Dict]:
    with open(TIMELINES_FILE, encoding="utf-8") as f:
        return json.load(f)

# ── Prompt builders ────────────────────────────────────────────────────────────

ENTITY_SYSTEM = """You are a scholarly editor specialising in the history of Western esotericism, Neoplatonism, alchemy, Kabbalah, Hermeticism, Renaissance magic, and Islamic esotericism. You have access to a private research archive of 249 ChatGPT conversations and a library of 459 specialist PDFs. Your task is to write richly detailed, academically precise encyclopedia entries for key thinkers, texts, and concepts. Every claim must be supportable by the source material provided.

RULES:
- Write in flowing prose, not bullet points
- Be specific: cite texts, dates, doctrines, debates
- Note historical influence and reception, not just biography
- Note what is contested or uncertain in scholarship
- Do NOT use em-dashes (—); use commas or semicolons instead
- Return valid JSON exactly matching the schema specified
"""

TOPIC_SYSTEM = """You are a scholarly editor working on a research study guide for esoteric studies. Your task is to synthesise what a researcher learned about a given topic from 249 research conversations, and produce structured, detailed entries for a scholarly study portal. Ground everything in the source material provided.

RULES:
- Be specific to what was actually studied, not a general survey
- Note specific texts, thinkers, and debates that came up
- Identify genuine open questions that remain unresolved
- Write in flowing academic prose
- Do NOT use em-dashes (—); use commas or semicolons instead
- Return valid JSON exactly matching the schema specified
"""

def build_entity_prompt(entity: Dict, chat_ctx: str, pdf_ctx: str) -> str:
    current_blurb = entity.get("blurb", "")
    eid = entity["id"]
    label = entity["label"]
    etype = entity["type"]
    aliases = ", ".join(entity.get("aliases", []))
    tags = ", ".join(entity.get("tags", []))

    return f"""{ENTITY_SYSTEM}

## Target Entity

- **ID:** {eid}
- **Type:** {etype}
- **Label:** {label}
- **Aliases:** {aliases}
- **Current tags:** {tags}
- **Current blurb (to be improved):** {current_blurb}

{chat_ctx}

{pdf_ctx}

## Task

Write an improved encyclopedia entry for **{label}**. Use the archive conversations and PDF passages as primary sources. Return a JSON object with EXACTLY these fields:

```json
{{
  "id": "{eid}",
  "blurb": "One paragraph, 150-220 words. Dates, tradition, major contributions, key texts, historical significance. No bullet points.",
  "blurb_long": "Two to three paragraphs, 350-500 words. Detailed treatment: intellectual formation, key doctrines, major works with dates, relationship to the esoteric tradition, historical reception and influence, scholarly debates. No bullet points.",
  "tags": ["tag1", "tag2", "tag3"],
  "connections": ["other_entity_id_1", "other_entity_id_2"],
  "open_questions": "One or two sentences: what aspects remain contested or under-studied in current scholarship."
}}
```

Tags should be 3-7 lowercase single-word or hyphenated terms from: neoplatonism, alchemy, kabbalah, hermeticism, renaissance, islamic, gnosticism, theurgy, magic, astrology, medicine, theology, philosophy, translation, synthesis, christianity, mysticism, sufism, mathematics.

Connections should be entity IDs from this set (use only what is genuinely relevant):
thinker_ficino, thinker_pico, thinker_plotinus, thinker_proclus, thinker_ikhwan, thinker_iamblichus, thinker_porphyry, thinker_pseudo_dionysius, thinker_agrippa, thinker_paracelsus, thinker_bruno, thinker_dee, thinker_fludd, thinker_kircher, thinker_albertus_magnus, thinker_pythagoras, thinker_plato, thinker_aristotle, thinker_hermes, thinker_ibn_sina, thinker_ibn_rushd, thinker_al_farabi, thinker_al_buni, thinker_abulafia, thinker_roger_bacon, thinker_ikhwan, text_corpus_hermeticum, text_enneads, text_de_occulta, text_picatrix, text_zohar, text_sefer_yetzirah, text_oration, concept_emanation, concept_neoplatonism, concept_theurgy, concept_kabbalah, concept_hermeticism, concept_prisca_theologia, concept_world_soul, concept_alchemy, concept_astral_magic, concept_the_one, concept_renaissance_magic
"""

def build_topic_prompt(topic: Dict, chat_ctx: str, pdf_ctx: str) -> str:
    name = topic["name"]
    rank = topic["rank"]
    current_what = topic.get("what_it_is", "")
    current_studied = topic.get("what_studied", "")
    current_connections = topic.get("connections", [])
    current_questions = topic.get("open_questions", "")
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")

    return f"""{TOPIC_SYSTEM}

## Target Topic

- **Name:** {name}
- **Rank in study archive:** #{rank} (of 50 most-studied topics)
- **Current what_it_is:** {current_what[:300] if current_what else '(empty)'}
- **Current what_studied:** {current_studied[:300] if current_studied else '(empty)'}
- **Current connections:** {current_connections}
- **Current open_questions:** {current_questions[:200] if current_questions else '(empty)'}

{chat_ctx}

{pdf_ctx}

## Task

Write an improved entry for the topic **{name}** as it was studied in the research archive. Return a JSON object with EXACTLY these fields:

```json
{{
  "name": "{name}",
  "slug": "{slug}",
  "what_it_is": "2-3 sentences, 60-100 words. What is this topic in the history of esotericism? Define it precisely.",
  "what_studied": "3-5 sentences, 100-180 words. What specific aspects, texts, debates, and questions about this topic came up in the research conversations? Be specific to what was actually discussed.",
  "connections": ["TopicName1", "TopicName2", "TopicName3"],
  "open_questions": "2-4 sentences, 60-120 words. What unresolved questions, ongoing debates, or gaps in the research remain? Be specific.",
  "key_figures": ["Name1", "Name2", "Name3"],
  "key_texts": ["Text1 (date)", "Text2 (date)"]
}}
```

Connections should be names of closely related topics from the Top 50 list. Key figures are the thinkers most associated with this topic in the archive. Key texts are the most important primary sources for this topic.
"""

def build_timeline_prompt(event: Dict, timeline_name: str, chat_ctx: str, pdf_ctx: str) -> str:
    eid = event.get("id", "")
    title = event.get("title", "")
    start = event.get("start", "")
    end = event.get("end", "")
    current_desc = event.get("description_md", "")
    related = event.get("related_entities", [])
    tags = event.get("tags", [])

    return f"""You are a scholarly editor writing timeline event descriptions for a history of esotericism portal. Write in precise, engaging academic prose. Cite specific texts, dates, and figures. Do not use bullet points or em-dashes.

## Timeline: {timeline_name}

## Target Event

- **Event ID:** {eid}
- **Title:** {title}
- **Date:** {start} to {end}
- **Related entities:** {related}
- **Tags:** {tags}
- **Current description (to improve):** {current_desc}

{chat_ctx}

{pdf_ctx}

## Task

Write an improved description for this timeline event. Return a JSON object:

```json
{{
  "id": "{eid}",
  "description_md": "2-3 paragraphs in markdown. 150-300 words. First paragraph: what happened and its immediate context. Second paragraph: its significance for the esoteric tradition. Optional third paragraph: its reception or long-term influence. Use **bold** for key names and texts. Use *italics* for titles.",
  "citations": [
    {{"source": "PDF filename or conversation title", "note": "brief description of what it says"}}
  ]
}}
```

Citations should reference the source material provided above. Include 1-3 citations.
"""

# ── Main processing functions ──────────────────────────────────────────────────

def process_entity(entity: Dict, model: str = DEFAULT_MODEL, force: bool = False) -> Optional[Dict]:
    eid = entity["id"]
    label = entity["label"]
    out_file = OUTPUT_DIR / "entities" / f"{eid}.json"

    if out_file.exists() and not force:
        print(f"  [skip] {eid} (already exists, use --force to overwrite)")
        return None

    print(f"  Processing entity: {label} ({eid})")

    # Build search query from label + tags + aliases
    aliases = entity.get("aliases", [])
    query = " ".join([label] + aliases[:2])

    chat_ctx = get_chat_context(query, limit=15)
    pdf_ctx  = get_pdf_context(query, top=4)
    prompt   = build_entity_prompt(entity, chat_ctx, pdf_ctx)

    print(f"    Chat turns: {chat_ctx.count('**Conversation:**')}")
    print(f"    PDF hits:   {pdf_ctx.count('**') // 2}")

    try:
        raw = call_gemini(prompt, model_name=model)
        result = json.loads(raw)
        result["_source_entity"] = eid
        result["_model"] = model
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"    Saved to {out_file.name}")
        return result
    except Exception as e:
        print(f"    ERROR: {e}", file=sys.stderr)
        return None

def process_topic(topic: Dict, model: str = DEFAULT_MODEL, force: bool = False) -> Optional[Dict]:
    name = topic["name"]
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    out_file = OUTPUT_DIR / "topics" / f"{slug}.json"

    if out_file.exists() and not force:
        print(f"  [skip] {name} (already exists, use --force to overwrite)")
        return None

    print(f"  Processing topic: {name}")

    chat_ctx = get_chat_context(name, limit=15)
    pdf_ctx  = get_pdf_context(name, top=4)
    prompt   = build_topic_prompt(topic, chat_ctx, pdf_ctx)

    try:
        raw = call_gemini(prompt, model_name=model)
        result = json.loads(raw)
        result["_source_name"] = name
        result["_model"] = model
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"    Saved to {out_file.name}")
        return result
    except Exception as e:
        print(f"    ERROR: {e}", file=sys.stderr)
        return None

def process_timeline_event(event: Dict, timeline_name: str, model: str = DEFAULT_MODEL, force: bool = False) -> Optional[Dict]:
    eid = event.get("id", "")
    title = event.get("title", "")
    out_file = OUTPUT_DIR / "timelines" / f"{eid}.json"

    if out_file.exists() and not force:
        print(f"  [skip] {eid} (already exists)")
        return None

    print(f"  Processing timeline event: {title} ({eid})")

    query = f"{title} {' '.join(event.get('related_entities', []))}"
    chat_ctx = get_chat_context(query, limit=10)
    pdf_ctx  = get_pdf_context(query, top=3)
    prompt   = build_timeline_prompt(event, timeline_name, chat_ctx, pdf_ctx)

    try:
        raw = call_gemini(prompt, model_name=model)
        result = json.loads(raw)
        result["_source_event"] = eid
        result["_model"] = model
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"    Saved to {out_file.name}")
        return result
    except Exception as e:
        print(f"    ERROR: {e}", file=sys.stderr)
        return None

# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Gemini-powered entry writer for EsoPipe Studio")
    parser.add_argument("mode", choices=["entity", "topic", "timeline"],
                        help="What to improve")
    parser.add_argument("target", nargs="?", default=None,
                        help="Entity ID, topic name, or event ID (omit with --all)")
    parser.add_argument("--all",          action="store_true", help="Process all entries")
    parser.add_argument("--force",        action="store_true", help="Overwrite existing output files")
    parser.add_argument("--model",        default=DEFAULT_MODEL,
                        help=f"Gemini model (default: {DEFAULT_MODEL})")
    parser.add_argument("--timeline-id",  default=None,
                        help="Timeline ID filter when mode=timeline and no --all")
    parser.add_argument("--delay",        type=float, default=5.0,
                        help="Seconds between API calls (default 5s = 12 RPM, within 15 RPM free tier)")
    args = parser.parse_args()

    # ── Entity mode ────────────────────────────────────────────────────────────
    if args.mode == "entity":
        entities = load_entities()
        if args.all:
            targets = entities
        elif args.target:
            targets = [e for e in entities if e["id"] == args.target]
            if not targets:
                sys.exit(f"Entity '{args.target}' not found. Available IDs:\n" +
                         "\n".join(e["id"] for e in entities))
        else:
            parser.error("Specify an entity ID or use --all")

        print(f"\nProcessing {len(targets)} entities with {args.model}\n")
        for i, entity in enumerate(targets):
            process_entity(entity, model=args.model, force=args.force)
            if i < len(targets) - 1:
                time.sleep(args.delay)

    # ── Topic mode ─────────────────────────────────────────────────────────────
    elif args.mode == "topic":
        topics = load_topics()
        if args.all:
            targets = topics
        elif args.target:
            targets = [t for t in topics if t["name"].lower() == args.target.lower()]
            if not targets:
                sys.exit(f"Topic '{args.target}' not found. Available topics:\n" +
                         "\n".join(t["name"] for t in topics))
        else:
            parser.error("Specify a topic name or use --all")

        print(f"\nProcessing {len(targets)} topics with {args.model}\n")
        for i, topic in enumerate(targets):
            process_topic(topic, model=args.model, force=args.force)
            if i < len(targets) - 1:
                time.sleep(args.delay)

    # ── Timeline mode ──────────────────────────────────────────────────────────
    elif args.mode == "timeline":
        timelines = load_timelines()
        events_to_process = []
        for tl in timelines:
            if args.timeline_id and tl.get("timeline_id") != args.timeline_id:
                continue
            for event in tl.get("events", []):
                if not args.all and args.target and event.get("id") != args.target:
                    continue
                events_to_process.append((event, tl.get("title", "")))

        if not events_to_process and not args.all:
            sys.exit(f"No matching timeline events found for '{args.target}'.")

        print(f"\nProcessing {len(events_to_process)} timeline events with {args.model}\n")
        for i, (event, tl_name) in enumerate(events_to_process):
            process_timeline_event(event, tl_name, model=args.model, force=args.force)
            if i < len(events_to_process) - 1:
                time.sleep(args.delay)

    print("\nDone. Review output files in writing_output/, then run: python patch_entries.py")

if __name__ == "__main__":
    main()
