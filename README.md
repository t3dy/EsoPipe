# EsoPipe — CS for Magical Scholarship

A data pipeline and interactive research site built from 249 ChatGPT conversations about Renaissance magic, Neoplatonism, Islamic esotericism, and related traditions.

## Live Site

**[https://t3dy.github.io/EsoPipe/](https://t3dy.github.io/EsoPipe/)**

---

## What Is This

EsoPipe started as a question: *what is actually in two years of scholarly AI conversations?*

The answer turned out to be 249 conversations, 9,864 message turns, 3.16 million words of AI text, and 598 scholarly comparison tables — covering Plotinus, Ficino, al-Buni, Ikhwan al-Safa, Agrippa, Paracelsus, and dozens of related figures and texts. Rather than leave that material in a folder of HTML exports, this project mines it into a structured research tool.

The site also demonstrates that the skills used in building data pipelines — schema design, entity extraction, graph traversal, iterative prompt engineering — are the same skills needed for rigorous humanistic scholarship. The Lessons page makes that argument explicit.

---

## The Archive in Numbers

| Metric | Value |
|--------|-------|
| Conversations imported | 249 |
| Total message turns | 9,864 |
| User turns (questions) | 4,056 |
| Assistant turns (responses) | 4,426 |
| Words of AI text | 3,162,473 |
| Date range | September 2024 – February 2026 |
| Scholarly tables extracted | 598 |
| Raw table-building requests | 547 |

Top topics by entity mention: alchemy (3,618), Aristotle (1,000), Neoplatonism (966), Plato (913), the One (710), Pico della Mirandola (695), Paracelsus (626), Ficino (530).

---

## Website Sections

### Home
Overview cards with archive stats: total conversations, tables, entities, date range.

### Lessons
CS curriculum units taught through esoteric studies research. Each lesson pairs a CS concept (schema design, graph traversal, vector embeddings, etc.) with a concrete scholarly application. Difficulty: intro / intermediate / advanced.

### Tables
**598 mined tables** extracted from the conversation archive, plus 4 hand-authored reference tables. Grouped by template type with search/filter sidebar. Each table exportable as CSV.

The five scholarly table templates derived from analysing 547 table-building requests:

| Template | Use Case | Signature Columns |
|----------|----------|-------------------|
| Tradition Comparison | How multiple schools handle the same concept | Concept, Thinker A, Thinker B, Takeaway |
| Scholar Profile | Figures in secondary literature | Figure, Works, Contributions, Challenges, Methodology |
| Comparative Inventory | Surveying a corpus or set of practices | Category, Description, Context, Evidence, Notes |
| Argument Audit | Stress-testing a central claim | Claim, Evidence, Sources, Challenges, Lacunae |
| Article Decomposition | Mapping an academic article structurally | Section, Contents, Methodology, Quotation, Takeaway |

### Timelines
Interactive chronological display of key events across the Neoplatonic transmission, Renaissance revival, and Islamic esoteric tradition.

### Graph
Force-directed knowledge graph of thinkers, texts, and concepts — with edges based on co-occurrence mining across all 249 conversations.

### Reports
Full-text viewer for pipeline analysis reports, all downloadable:

- **Scholarly Pipeline Report** — 38 KB analysis: entity frequencies, table pattern analysis, request type distributions, four-week pipeline roadmap
- **Mining Stats** — quick summary produced each time the archive is re-indexed
- **Column Name Frequency** — ranked list of every column header found across 941 raw tables
- **Table Study Raw Data** — verbatim record of all 547 table-building requests, used to derive the five templates

### Schema
Live JSON schema documentation with real-time validation error display.

---

## Pipeline Scripts

### mine_chats.py
Parses all 249 ChatGPT HTML exports into SQLite (`esoteric_archive.db`). Extracts entity mentions, request type classifications, and conversation metadata. Also produces `topic_catalog.html` and `mine_report.txt`.

```bash
python mine_chats.py --dir . --db esoteric_archive.db --esopipe-dir cs-magical-scholarship/public/data/
```

### extract_tables.py
Re-reads raw HTML files directly (bypassing the database) to recover Markdown pipe-tables whose line structure the mining script's whitespace normalisation would destroy. Also captures HTML table elements. Outputs `tables_mined.json`.

```bash
python extract_tables.py --dir . --db esoteric_archive.db
```

Results: 941 raw tables found across 120 files, 598 passing quality filters (min 3 columns, min 2 rows, deduplicated by column fingerprint).

### /maketable — Claude Code Skill
A Claude Code slash command (`~/.claude/commands/maketable.md`) that reads any PDF or text file and generates all five table templates for it, then optionally appends results to `tables_mined.json` and pushes to the live site.

```
/maketable path/to/book.pdf
/maketable path/to/chapter.pdf --template scholar-profile
```

The skill knows the full 13-type column vocabulary, the formatting rules, and the EsoPipe JSON schema.

---

## Data Files

All data lives in `public/data/` as plain JSON — edit directly; the app validates on load.

| File | Contents |
|------|----------|
| entities.json | Thinkers, texts, and concepts with aliases and blurbs |
| edges.json | Relationships between entities |
| timelines.json | Timeline definitions with dated events |
| lessons.json | Curriculum lessons with code snippets and exercises |
| tables.json | 4 hand-authored scholarly reference tables |
| tables_mined.json | 598 tables extracted from the chat archive |
| reports/ | Plain-text reports viewable in the Reports page |

### Adding an Entity

```json
{
  "id": "thinker_agrippa",
  "type": "thinker",
  "label": "Heinrich Cornelius Agrippa",
  "aliases": ["Agrippa"],
  "blurb": "German polymath (1486-1535), author of De occulta philosophia.",
  "tags": ["renaissance", "magic", "kabbalah"],
  "links": []
}
```

Valid types: `thinker` | `text` | `concept` | `tool` | `term`

### Adding an Edge

```json
{
  "id": "e16",
  "source": "thinker_agrippa",
  "target": "thinker_ficino",
  "type": "derived-from",
  "weight": 2,
  "notes": "Agrippa builds on Ficino's De vita"
}
```

Valid edge types: `uses` | `explains` | `compares` | `derived-from` | `mentions`

---

## Themes

| Theme | Description |
|-------|-------------|
| Parchment | Warm ochre, ink-brown text, gold accents |
| Dark Academia | Deep charcoal, cream text, crimson accents |
| Academic Journal | Clean white, system sans-serif, navy blue |
| Mac Classic | Black and white, Chicago font, System 7 aesthetic |

Theme is saved to localStorage.

---

## Quick Start

```bash
cd cs-magical-scholarship
npm install
npm run dev
```

Open http://localhost:5173/EsoPipe/

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build to dist/ |
| `npm run preview` | Preview production build locally |

---

## Tech Stack

| Library | Purpose |
|---------|---------|
| Vite + React + TypeScript | Build tooling and components |
| Tailwind CSS | Styling with 4-theme CSS custom properties |
| React Router HashRouter | Client-side routing for GitHub Pages |
| TanStack Table | Sortable filterable tables with CSV export |
| @xyflow/react | Interactive knowledge graph |
| MiniSearch | Client-side full-text search |
| Prism.js | Syntax highlighting |
| Zod | Runtime JSON validation |
| Lucide React | Icons |

---

## Deployment

Built locally, pushed to master. GitHub Pages serves the built output.

```bash
cd cs-magical-scholarship
npm run build
git add -A && git commit -m "deploy" && git push
```

`vite.config.ts` sets `base: '/EsoPipe/'` — update if the repository name changes.

---

*Built with Claude Code · EsoPipe v0.1.0-alpha*
