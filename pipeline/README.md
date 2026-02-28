# EsoPipe — Scholarly Chat Mining Pipeline

This folder contains Python scripts for mining your ChatGPT conversation exports
into a structured SQLite database and generating visual topic catalogs.

## Quick Start

```bash
cd "your/chats/directory"
python mine_chats.py
```

Open `topic_catalog.html` in your browser for the visual catalog.

## mine_chats.py

Parses exported ChatGPT HTML files (the format produced by chat export tools)
into SQLite, then generates:

| Output | Description |
|--------|-------------|
| `esoteric_archive.db` | SQLite database of all conversations, turns, entity mentions, request types |
| `mine_report.txt` | Plain-text analysis summary |
| `topic_catalog.html` | **Visual HTML catalog** — open in browser |
| `entities_mined.json` | Entity data for EsoPipe (with `--esopipe-dir`) |
| `edges_mined.json` | Co-occurrence edges for EsoPipe (with `--esopipe-dir`) |

### Options

```
--dir PATH         Directory to scan for .html files (default: current dir)
--db PATH          SQLite database path (default: esoteric_archive.db)
--esopipe-dir PATH Write entities_mined.json + edges_mined.json here
--report NAME      Report filename (default: mine_report.txt)
--catalog NAME     Catalog filename (default: topic_catalog.html)
--force            Re-import files already in DB
--limit N          Only process first N files (for testing)
```

### Database Schema

```sql
conversations  — one row per HTML file (title, date, model, turn_count)
turns          — one row per message (role, content, word_count, request_types, entity_ids)
entity_mentions — thinker/text/concept spotted in a turn
request_types  — classified intent of each user turn
```

### Entity Dictionary

The script recognises ~40 entities across three types:
- **Thinkers**: Ficino, Pico, Plotinus, Agrippa, Bruno, Ikhwan al-Safa, Abulafia, ...
- **Texts**: Enneads, Corpus Hermeticum, Picatrix, Zohar, De occulta philosophia, ...
- **Concepts**: alchemy, kabbalah, theurgy, emanation, Neoplatonism, ...

Add new entries to `ENTITY_DICT` at the top of `mine_chats.py`.

### Feeding Data Back to EsoPipe

```bash
python mine_chats.py --esopipe-dir ../public/data/
```

This writes `entities_mined.json` and `edges_mined.json` to the EsoPipe data folder.
Update `src/data/loader.ts` to load these files alongside the hand-authored seed data.

## Requirements

Python 3.10+ (uses `str | None` type unions). No external dependencies — stdlib only.
