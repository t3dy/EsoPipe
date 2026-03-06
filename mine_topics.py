#!/usr/bin/env python3
"""
mine_topics.py — EsoPipe Topic Distillation Miner
===================================================
Identifies the top 50 topics from the esoteric studies chat archive and
produces a compact staging file (topic_staging.md) ready for Claude to
read and synthesize into TOPIC_DISTILLATION.md.

For each topic the dossier contains:
  - Type, score, mention count, unique conversations, top request types
  - Up to 5 representative USER QUESTIONS (first 120 words each)
  - Up to 3 most substantive ASSISTANT EXCERPTS (first 280 words each)
  - Top 5 co-occurring entities
  - Sample conversation titles

Usage:
    python mine_topics.py [--db PATH] [--out PATH]
"""

import argparse
import math
import re
import sqlite3
import sys
import io
import textwrap
from collections import Counter, defaultdict
from pathlib import Path

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ── Conversation-title themes not in the canonical entity list ────────────────
# These are surfaced by repeated words in conversation titles.
TITLE_THEMES = [
    {
        "id": "theme_ikhwan_alsafa",
        "label": "Ikhwan al-Safa (Brethren of Purity)",
        "type": "tradition",
        "keywords": ["ikhwan", "brethren", "purity", "rasa'il"],
    },
    {
        "id": "theme_rosicrucians",
        "label": "Rosicrucians",
        "type": "tradition",
        "keywords": ["rosicrucian", "rose-cross", "rosecross", "fama fraternitatis", "confessio"],
    },
    {
        "id": "theme_islamic_esotericism",
        "label": "Islamic Esotericism",
        "type": "tradition",
        "keywords": ["islamic esot", "sufi", "sufism", "ibn arabi", "islamicate", "buni", "al-buni"],
    },
    {
        "id": "theme_manuscript_culture",
        "label": "Manuscript Culture & Textual Transmission",
        "type": "tradition",
        "keywords": ["manuscript", "scribal", "textual transmission", "codicology", "paleograph"],
    },
    {
        "id": "theme_natural_philosophy",
        "label": "Natural Philosophy",
        "type": "concept",
        "keywords": ["natural philosophy", "scientia", "natural magic", "natura"],
    },
    {
        "id": "theme_number_theory",
        "label": "Pythagorean Number Theory & Harmonics",
        "type": "concept",
        "keywords": ["number theory", "harmonic", "tetractys", "musica universalis", "quadrivium"],
    },
    {
        "id": "theme_demonology",
        "label": "Demonology & Angelology",
        "type": "concept",
        "keywords": ["demon", "angel", "demonolog", "angelolog", "spirit", "goetia"],
    },
    {
        "id": "theme_hermeticism",
        "label": "Hermeticism (broader tradition)",
        "type": "tradition",
        "keywords": ["hermetic", "hermeticism", "hermetical", "trismegistus"],
    },
]


def clean(text: str, max_words: int) -> str:
    """Trim text to max_words words, strip excess whitespace."""
    text = re.sub(r"\s+", " ", text or "").strip()
    words = text.split()
    if len(words) > max_words:
        return " ".join(words[:max_words]) + "…"
    return text


def get_entity_dossier(conn, entity_id: str, entity_label: str, max_q: int = 4, max_a: int = 2):
    """Return dict with user questions, assistant excerpts, co-entities, conv titles."""

    # User questions mentioning this entity (most recent / most words)
    user_turns = conn.execute("""
        SELECT t.content, c.title, c.date
        FROM turns t
        JOIN entity_mentions em ON em.turn_id = t.id
        JOIN conversations c ON c.id = t.conversation_id
        WHERE em.entity_id = ?
          AND t.role = 'user'
          AND t.word_count >= 8
        ORDER BY t.word_count DESC
        LIMIT 20
    """, (entity_id,)).fetchall()

    # Deduplicate by first 60 chars
    seen_q = set()
    questions = []
    for row in user_turns:
        key = row[0][:60]
        if key not in seen_q:
            seen_q.add(key)
            questions.append(clean(row[0], 80))
            if len(questions) >= max_q:
                break

    # Assistant turns (most words, mentioning entity)
    asst_turns = conn.execute("""
        SELECT t.content, t.word_count
        FROM turns t
        JOIN entity_mentions em ON em.turn_id = t.id
        WHERE em.entity_id = ?
          AND t.role = 'assistant'
          AND t.word_count >= 100
        ORDER BY t.word_count DESC
        LIMIT 8
    """, (entity_id,)).fetchall()

    seen_a = set()
    excerpts = []
    for row in asst_turns:
        key = row[0][:80]
        if key not in seen_a:
            seen_a.add(key)
            excerpts.append(clean(row[0], 200))
            if len(excerpts) >= max_a:
                break

    # Co-occurring entities (top 5 by shared conversations)
    co_entities = conn.execute("""
        SELECT e.label, COUNT(DISTINCT em2.conversation_id) as shared
        FROM entity_mentions em1
        JOIN entity_mentions em2 ON em2.conversation_id = em1.conversation_id
                                 AND em2.entity_id != em1.entity_id
        JOIN entities e ON e.id = em2.entity_id
        WHERE em1.entity_id = ?
        GROUP BY em2.entity_id
        ORDER BY shared DESC
        LIMIT 6
    """, (entity_id,)).fetchall()
    co_labels = [r[0] for r in co_entities if r[0] != entity_label][:5]

    # Sample conversation titles (use only short, clean titles from conversations table)
    titles = conn.execute("""
        SELECT DISTINCT c.title
        FROM conversations c
        JOIN entity_mentions em ON em.conversation_id = c.id
        WHERE em.entity_id = ?
          AND LENGTH(c.title) < 80
        ORDER BY c.date DESC
        LIMIT 6
    """, (entity_id,)).fetchall()
    title_list = [r[0] for r in titles]

    return {
        "questions": questions,
        "excerpts": excerpts,
        "co_entities": co_labels,
        "conv_titles": title_list,
    }


def get_theme_dossier(conn, theme: dict, max_q: int = 4, max_a: int = 2):
    """Build a dossier for a conversation-title-based theme using FTS."""
    kw_pattern = "|".join(re.escape(k) for k in theme["keywords"])

    # Find all turns (user) whose content matches the keywords
    user_rows = conn.execute("""
        SELECT t.content, c.title, c.date
        FROM turns t
        JOIN conversations c ON c.id = t.conversation_id
        WHERE t.role = 'user'
          AND t.word_count >= 8
          AND (LOWER(t.content) REGEXP ?)
        ORDER BY t.word_count DESC
        LIMIT 20
    """, (kw_pattern,)).fetchall() if False else []  # REGEXP not available by default

    # Fallback: search via conversation titles matching keywords
    where_parts = " OR ".join(["LOWER(c.title) LIKE ?" for _ in theme["keywords"]])
    params = [f"%{k}%" for k in theme["keywords"]]
    conv_rows = conn.execute(f"""
        SELECT DISTINCT c.id, c.title, c.date
        FROM conversations c
        WHERE {where_parts}
        ORDER BY c.date DESC
        LIMIT 20
    """, params).fetchall()

    conv_ids = [r[0] for r in conv_rows]
    title_list = [r[1] for r in conv_rows][:6]

    if not conv_ids:
        # Also try keyword in turn content
        content_parts = " OR ".join(["LOWER(t.content) LIKE ?" for _ in theme["keywords"]])
        c_params = [f"%{k}%" for k in theme["keywords"]]
        content_rows = conn.execute(f"""
            SELECT DISTINCT t.conversation_id
            FROM turns t
            WHERE ({content_parts})
            LIMIT 30
        """, c_params).fetchall()
        conv_ids = [r[0] for r in content_rows]

    if not conv_ids:
        return {"questions": [], "excerpts": [], "co_entities": [], "conv_titles": title_list}

    placeholders = ",".join("?" * len(conv_ids))

    # User questions in those conversations
    user_turns = conn.execute(f"""
        SELECT t.content, c.title
        FROM turns t
        JOIN conversations c ON c.id = t.conversation_id
        WHERE t.conversation_id IN ({placeholders})
          AND t.role = 'user'
          AND t.word_count >= 8
        ORDER BY t.word_count DESC
        LIMIT 20
    """, conv_ids).fetchall()

    seen_q = set()
    questions = []
    for row in user_turns:
        key = row[0][:60]
        if key not in seen_q:
            seen_q.add(key)
            questions.append(clean(row[0], 80))
            if len(questions) >= max_q:
                break

    # Assistant excerpts
    asst_turns = conn.execute(f"""
        SELECT t.content, t.word_count
        FROM turns t
        WHERE t.conversation_id IN ({placeholders})
          AND t.role = 'assistant'
          AND t.word_count >= 100
        ORDER BY t.word_count DESC
        LIMIT 8
    """, conv_ids).fetchall()

    seen_a = set()
    excerpts = []
    for row in asst_turns:
        key = row[0][:80]
        if key not in seen_a:
            seen_a.add(key)
            excerpts.append(clean(row[0], 200))
            if len(excerpts) >= max_a:
                break

    # Top co-entities from those conversations
    if conv_ids:
        co_rows = conn.execute(f"""
            SELECT e.label, COUNT(*) as cnt
            FROM entity_mentions em
            JOIN entities e ON e.id = em.entity_id
            WHERE em.conversation_id IN ({placeholders})
            GROUP BY em.entity_id
            ORDER BY cnt DESC
            LIMIT 6
        """, conv_ids).fetchall()
        co_labels = [r[0] for r in co_rows][:5]
    else:
        co_labels = []

    return {
        "questions": questions,
        "excerpts": excerpts,
        "co_entities": co_labels,
        "conv_titles": title_list,
    }


def format_dossier_block(rank: int, label: str, entity_type: str,
                          score: float, mentions: int, unique_convs: int,
                          top_req_types: list, dossier: dict) -> str:
    lines = []
    lines.append(f"\n{'='*72}")
    lines.append(f"TOPIC {rank:02d}: {label.upper()}")
    lines.append(f"{'='*72}")
    lines.append(f"Type: {entity_type} | Score: {score:.1f} | "
                 f"Mentions: {mentions} | Conversations: {unique_convs}")
    if top_req_types:
        req_str = ", ".join(f"{t}({c})" for t, c in top_req_types[:5])
        lines.append(f"Request types: {req_str}")

    if dossier["conv_titles"]:
        lines.append(f"\nSAMPLE CONVERSATIONS:")
        for t in dossier["conv_titles"][:5]:
            lines.append(f"  • {str(t)[:80]}")

    if dossier["co_entities"]:
        lines.append(f"\nTOP CO-OCCURRING TOPICS: {', '.join(dossier['co_entities'])}")

    if dossier["questions"]:
        lines.append(f"\nUSER QUESTIONS (representative):")
        for i, q in enumerate(dossier["questions"], 1):
            wrapped = textwrap.fill(q, width=80, initial_indent=f"  Q{i}: ",
                                    subsequent_indent="      ")
            lines.append(wrapped)

    if dossier["excerpts"]:
        lines.append(f"\nASSISTANT KNOWLEDGE (excerpts):")
        for i, e in enumerate(dossier["excerpts"], 1):
            lines.append(f"\n  [Excerpt {i}]")
            wrapped = textwrap.fill(e, width=80, initial_indent="  ",
                                    subsequent_indent="  ")
            lines.append(wrapped)

    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db",  default="esoteric_archive.db")
    ap.add_argument("--out", default="topic_staging.md")
    args = ap.parse_args()

    db_path  = Path(args.db).resolve()
    out_path = Path(args.out).resolve()

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    print("Mining topics from the archive…\n")

    # ── 1. Load all canonical entities with mention stats ─────────────────────
    entity_rows = conn.execute("""
        SELECT
            e.id,
            e.label,
            e.type,
            COUNT(DISTINCT em.turn_id)         AS mention_count,
            COUNT(DISTINCT em.conversation_id) AS unique_convs
        FROM entities e
        LEFT JOIN entity_mentions em ON em.entity_id = e.id
        GROUP BY e.id
        ORDER BY mention_count DESC
    """).fetchall()

    # ── 2. Get request type counts per entity ─────────────────────────────────
    entity_req = defaultdict(Counter)
    req_rows = conn.execute("""
        SELECT em.entity_id, rt.request_type, COUNT(*) AS cnt
        FROM entity_mentions em
        JOIN request_types rt ON rt.turn_id = em.turn_id
        GROUP BY em.entity_id, rt.request_type
    """).fetchall()
    for row in req_rows:
        entity_req[row[0]][row[1]] += row[2]

    # ── 3. Score entities ──────────────────────────────────────────────────────
    scored = []
    for row in entity_rows:
        eid   = row["id"]
        label = row["label"]
        etype = row["type"]
        mc    = row["mention_count"] or 0
        uc    = row["unique_convs"]  or 0
        req_diversity = len(entity_req[eid])
        score = mc * math.log(max(uc, 1) + 1) * (req_diversity + 1)
        top_req = entity_req[eid].most_common(5)
        scored.append((score, eid, label, etype, mc, uc, top_req))

    scored.sort(reverse=True)

    # ── 4. Score title themes and add them ────────────────────────────────────
    all_titles_str = " ".join(
        r[0].lower() for r in conn.execute("SELECT title FROM conversations").fetchall()
    )
    theme_scored = []
    for theme in TITLE_THEMES:
        hits = sum(all_titles_str.count(k.lower()) for k in theme["keywords"])
        if hits >= 1:
            theme_scored.append((hits * 8, theme))  # scale so they compete with lower entities
    theme_scored.sort(key=lambda x: x[0], reverse=True)

    # ── 5. Build combined top-50 list ─────────────────────────────────────────
    # Take top 46 entities, then fill with title themes up to 50
    final_topics = []
    for entry in scored[:46]:
        final_topics.append(("entity", entry))
    added_themes = 0
    for tscore, theme in theme_scored:
        if len(final_topics) >= 50:
            break
        final_topics.append(("theme", (tscore, theme)))
        added_themes += 1

    print(f"  Canonical entities: {min(46, len(scored))}")
    print(f"  Title themes added: {added_themes}")
    print(f"  Total topics: {len(final_topics)}\n")

    # ── 6. Build dossier for each topic and write staging file ────────────────
    output_lines = []
    output_lines.append("# EsoPipe Topic Distillation — Staging File")
    output_lines.append(f"# {len(final_topics)} topics extracted from 249 conversations")
    output_lines.append("# This file is read by Claude to write TOPIC_DISTILLATION.md\n")

    for rank, (kind, entry) in enumerate(final_topics, 1):
        if kind == "entity":
            score, eid, label, etype, mc, uc, top_req = entry
            print(f"  [{rank:02d}] {label} ({mc} mentions)…")
            dossier = get_entity_dossier(conn, eid, label)
            block = format_dossier_block(rank, label, etype, score, mc, uc, top_req, dossier)
        else:
            tscore, theme = entry
            label = theme["label"]
            print(f"  [{rank:02d}] {label} [title theme]…")
            dossier = get_theme_dossier(conn, theme)
            mc  = sum(all_titles_str.count(k.lower()) for k in theme["keywords"])
            uc  = len(dossier["conv_titles"])
            block = format_dossier_block(rank, label, theme["type"],
                                          tscore, mc, uc, [], dossier)
        output_lines.append(block)

    conn.close()

    staging_text = "\n".join(output_lines)
    out_path.write_text(staging_text, encoding="utf-8")

    word_count = len(staging_text.split())
    print(f"\nStaging file written → {out_path}")
    print(f"  Words: {word_count:,}")
    print(f"  Characters: {len(staging_text):,}")
    print(f"\nReady for Claude to read and synthesize.")


if __name__ == "__main__":
    main()
