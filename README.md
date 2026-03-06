# EsoPipe Studio — Research Tool for Esoteric Studies

A structured research environment built from 249 ChatGPT conversations covering Renaissance magic, Neoplatonism, Islamic esotericism, alchemy, Kabbalah, and Hermeticism. Available as a **live website** and a **self-contained desktop application**.

## Live Site

**[https://t3dy.github.io/EsoPipe/](https://t3dy.github.io/EsoPipe/)**

---

## What Is This

EsoPipe started as a question: *what is actually in two years of scholarly AI conversations?*

The answer turned out to be 249 conversations, 9,864 message turns, 3.16 million words of AI text, and 598 scholarly comparison tables — covering Plotinus, Ficino, al-Buni, Ikhwān al-Ṣafāʾ, Agrippa, Paracelsus, and dozens of related figures and texts. Rather than leave that material in a folder of HTML exports, this project mines it into a structured research tool.

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

## Desktop Application (EsoPipe Studio)

EsoPipe Studio is a self-contained Windows desktop application that bundles the full FastAPI backend and React frontend into a single `.exe`. It runs locally without an internet connection and adds LLM chat powered by a local Ollama model.

### Requirements

- Windows 10 / 11 (64-bit)
- Microsoft Edge or Google Chrome installed (used as the app window frame)
- [Ollama](https://ollama.ai) installed and running for LLM features (optional)

### Running the Desktop App

1. Download and extract `EsoPipe Studio` from the releases folder
2. Double-click **`EsoPipe Studio.exe`**
3. A chrome-less Edge/Chrome window titled "EsoPipe Studio" opens automatically
4. Close the window to shut down the application

The launcher picks a random free port on startup, starts a local FastAPI server, waits for it to be healthy, then opens the browser window. Closing the window shuts the server down cleanly.

**Logs** are written to `%LOCALAPPDATA%\EsoPipe2\logs\launcher.log` for troubleshooting.

### LLM Chat (Desktop Only)

The `/llm/chat` endpoint streams responses from a locally running Ollama model. Default model: `qwen2.5:14b`.

```bash
# Install and start Ollama
ollama pull qwen2.5:14b
ollama serve
```

The chat assistant is a scholarly research assistant specialising in esoteric studies. It automatically retrieves relevant passages from the archive (hybrid FTS5 + vector retrieval) and includes them as context with every query. You can pin a specific conversation for additional context.

---

## Website Sections

### Home
Landing page with feature overview cards, archive statistics (conversations, tables, entities, date range), and a brief philosophy section.

---

### Conversations
Browse all 249 archived research conversations. Features:
- **Search** by title or full-text content
- **Filter** by request type: Summary, Analysis, Comparison, Methodology, Timeline, Translation
- **Sort** by date (newest first)
- Each row shows title, date, turn count, and word count

Click any conversation to open the full thread. Conversations render as expandable/collapsible turns with user/assistant distinction. Long assistant turns are truncated with an expand control. Semantic autolinking is active on the first 2,000 characters of each turn.

---

### Topics
Sidebar-based portal for the 50 highest-density study topics, ranked by a composite score of mention frequency × breadth × diversity of evidence.

Topics are organized in five tiers:

| Tier | Examples |
|------|---------|
| **Foundations** | alchemy, Neoplatonism, the One, emanation, theurgy |
| **Renaissance Core** | Ficino, Pico della Mirandola, Agrippa, prisca theologia |
| **Specialists** | Proclus, Iamblichus, Paracelsus, John Dee |
| **Specific Texts** | Corpus Hermeticum, Enneads, De occulta philosophia |
| **Islamic & Late** | Ibn Sina, al-Buni, Ikhwān al-Ṣafāʾ, Kabbalah |

Each topic page includes:
- **What it is** — a concise scholarly definition
- **What you've studied** — the questions and angles explored in your conversations
- **Key connections** — linked entities that co-occur with this topic
- **Open questions** — contested or unresolved points in the archive

Toggle semantic autolinking for the entire topic with the Links button.

---

### Entities
Entity detail pages (accessed by clicking any linked name throughout the app, or directly via `/entities/:id`). Each page shows:
- **Type badge** — thinker / text / concept / tool / term
- **Mention count & conversation count** from the archive
- **Blurb** — 1–3 sentence scholarly description with autolinking active
- **Aliases** — alternative names the entity is known by
- **Tags** — tradition and domain tags
- **Relations** — incoming and outgoing edges to other entities (color-coded by edge type)
- **External links** — SEP, Wikipedia, etc.
- **Related conversations** — conversations in the archive where this entity appears (sorted by date)
- **Co-entities sidebar** — the 8 most frequently co-occurring entities

The **"Open in Graph"** button focuses the knowledge graph on this entity with a 1-hop neighborhood view.

---

### Semantic Linking

Every piece of prose in the app — topic descriptions, entity blurbs, conversation turns — is a traversable network. Recognized entity names, alchemy terms, and topic names are automatically underlined with a subtle dotted border.

**How it works:**
- Hovering over a linked term shows a **HoverCard** with a Wikipedia-style preview: blurb, tags, co-occurring figures, and navigation actions (Go to page / Open in Graph)
- Clicking navigates to the full entity or topic page
- Ambiguous terms (e.g. "Mercury" = element or planet or figure) open a **disambiguation popover** listing all possible targets
- On mobile: first tap shows the HoverCard; second tap navigates

**Controls:**
- The **Links** toggle button (visible on Topics and Conversations pages) shows/hides all link underlines
- **"Show more links ↓"** button appears on long passages; click to linkify the full text

See [`docs/semantic-linking.md`](docs/semantic-linking.md) for the full architecture, stoplist, editorial controls, and configuration.

---

### Search
Unified full-text search across six content types simultaneously:

| Type | Searched fields |
|------|----------------|
| Entities | label, aliases, blurb, tags |
| Conversations | title, full text (via MiniSearch) |
| Topics | title, what_it_is, what_youve_studied |
| Alchemy | term, category, definition, body |
| Timeline Events | label, description |
| Lessons | title, CS concepts, section content |

Results are scored and grouped by type. Use the **type filter pills** to narrow to a single category. Search queries persist in the URL (`?q=plotinus`) for sharing.

---

### Tables
**598 mined tables** extracted from the conversation archive, plus 4 hand-authored reference tables. All tables are filterable, searchable, and exportable as CSV.

**Sidebar controls:**
- Search by title, description, or tags
- Filter by template type
- Compact mode toggle

**The five scholarly table templates** derived from analysing 547 table-building requests:

| Template | Use Case | Signature Columns |
|----------|----------|-------------------|
| Philosophical Comparison | How multiple schools handle the same concept | Concept, Thinker A, Thinker B, Takeaway |
| Scholar Profile | Figures in secondary literature | Figure, Works, Contributions, Challenges, Methodology |
| Comparative Inventory | Surveying a corpus or set of practices | Category, Description, Context, Evidence, Notes |
| Evidence Audit | Stress-testing a central claim | Claim, Evidence, Sources, Challenges, Lacunae |
| Article Decomposition | Mapping an academic article structurally | Section, Contents, Methodology, Quotation, Takeaway |

Mined tables are badged with their source conversation. Click **Export CSV** to download any table.

---

### Timelines
Interactive chronological display across three tradition strands:
- **Neoplatonic Transmission** — Plotinus → Porphyry → Iamblichus → Proclus → Pseudo-Dionysius
- **Renaissance Florence** — Ficino, Pico, Agrippa, Bruno and the revival of Platonic magic
- **Islamic Esotericism** — Jabir ibn Hayyan through al-Buni and the Ikhwān al-Ṣafāʾ

Controls:
- Timeline selector (top)
- Tag filter to narrow by tradition, figure type, or century
- Click any event dot to expand the detail panel on the right with full description and linked entities

---

### Graph
Force-directed knowledge graph of 200+ thinkers, texts, and concepts with edges based on co-occurrence mining across all 249 conversations.

**Filter lenses:**
| Lens | What it shows |
|------|--------------|
| All Relations | Every edge in the dataset |
| Influence | `derived-from` and `uses` edges only — intellectual lineage |
| Concepts | `explains` and `mentions` edges — conceptual linkage |
| Co-occurrence | Edges generated from conversation co-mention frequency |

**Entity type checkboxes** toggle visibility of thinkers / texts / concepts / tools / terms independently.

**Focus mode:** Enter any entity name in the Focus box to isolate its N-hop neighborhood (1–3 hops). Click a node to open the entity drawer panel and update the URL for sharing.

---

### Alchemy Concepts
Encyclopedic reference for alchemy terminology. Categories include: Chemical Process, Operation, Stage, Substance, Apparatus, Symbol, Theoretical Framework, Concept, and Practitioner.

Use the category sidebar to navigate by theme, or search by term name across all categories. Expanding a term row shows the full definition and extended body text.

---

### Artifacts
The artifacts library stores structured scholarly outputs produced by the pipeline: entity profiles, comparison reports, audit results. Each artifact has:
- **Type badge** (whois / compare / audit)
- **Creation date and schema version**
- **Payload** rendered as markdown
- **Provenance links** to source conversations and entities

---

### Lessons
CS curriculum units taught through esoteric studies research. Each lesson pairs a computer science concept with a concrete scholarly application drawn from the archive.

**Difficulty levels:** Intro · Intermediate · Advanced

Each lesson contains:
- CS Concepts and Scholarly Application sections
- Multi-section content with prose and code examples
- Syntax-highlighted code snippets (Python, SQL, JSON)
- Exercises with collapsible solutions
- Related entities sidebar

Filter lessons by difficulty or topic tag from the sidebar.

---

### Reports
Full-text viewer for pipeline analysis reports:

| Report | Contents |
|--------|----------|
| **Scholarly Pipeline Report** | 38 KB analysis: entity frequencies, table pattern analysis, request type distributions, four-week pipeline roadmap |
| **Mining Stats** | Summary produced each time the archive is re-indexed |
| **Column Name Frequency** | Ranked list of every column header found across 941 raw tables |
| **Table Study Raw Data** | Verbatim record of all 547 table-building requests used to derive the five templates |
| **Topic Distillation** | Markdown report on the 50 ranked study topics |

All reports are downloadable.

---

### Schema
Live JSON schema documentation with real-time validation error display. Covers the Entity, Edge, Timeline, and Lesson schemas with JSON examples and ID convention explanations.

---

### Retrieval Debugger (`/debug/retrieval`)
Developer tool showing how the hybrid FTS5 + vector retrieval pipeline ranks passages for a given query. Displays per-result scores, ranking trace, and packed context output. Uses mock data to illustrate the retrieval policy: Stage 1 recall → Stage 2 rerank → diversity constraint.

---

## Themes

| Theme | Description |
|-------|-------------|
| **Parchment** | Warm ochre, ink-brown text, gold accents |
| **Dark Academia** | Deep charcoal, cream text, crimson accents |
| **Academic Journal** | Clean white, system sans-serif, navy blue |
| **Mac Classic** | Black and white, Chicago font, System 7 aesthetic |

Theme is saved to `localStorage` and persists across sessions.

---

## Quick Start (Web)

```bash
cd cs-magical-scholarship
npm install
npm run dev
```

Open [http://localhost:5173/EsoPipe/](http://localhost:5173/EsoPipe/)

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with hot reload at localhost:5173/EsoPipe/ |
| `npm run build` | Production build to `dist/` (base `/EsoPipe/` for GitHub Pages) |
| `npm run build:desktop` | Build for desktop app (base `/`, output to `dist-desktop/`) |
| `npm run preview` | Preview production build locally |
| `npm run test` | Run 30 unit tests (MiniSearch, LinkableIndex, scanText) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | ESLint check |

---

## Quick Start (Desktop Build)

```bash
# 1. Build frontend for desktop (base=/ not /EsoPipe/)
cd cs-magical-scholarship
npm run build:desktop

# 2. From the project root
cd ..
python -m PyInstaller "EsoPipe Studio.spec" -y
```

The built application is in `dist/EsoPipe Studio/`. Run `EsoPipe Studio.exe` directly — no installation required.

**Rebuilding after Python changes** only requires step 2. **Rebuilding after frontend changes** requires both steps.

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
A Claude Code slash command that reads any PDF or text file and generates all five table templates, then optionally appends results to `tables_mined.json` and pushes to the live site.

```
/maketable path/to/book.pdf
/maketable path/to/chapter.pdf --template scholar-profile
```

---

## Data Files

All data lives in `public/data/` as plain JSON — edit directly; the app validates on load via Zod schemas.

| File | Contents |
|------|----------|
| `entities.json` | Thinkers, texts, and concepts with aliases, blurbs, and tags |
| `edges.json` | Relationships between entities |
| `timelines.json` | Timeline definitions with dated events |
| `lessons.json` | Curriculum lessons with code snippets and exercises |
| `tables.json` | 4 hand-authored scholarly reference tables |
| `tables_mined.json` | 598 tables extracted from the chat archive |
| `artifacts.json` | Scholarly artifacts with provenance |
| `conversations.json` | Metadata for 249 conversations (title, date, turn count, word count) |
| `conversations/{id}.json` | Full conversation turn-by-turn data per conversation |
| `alchemyConcepts.json` | ~200 alchemy terms with definitions, categories, body text |
| `topics.json` | 50 study topics ranked by depth, with descriptions and connections |
| `reports/` | Plain-text pipeline analysis reports |

### Adding an Entity

```json
{
  "id": "thinker_agrippa",
  "type": "thinker",
  "label": "Heinrich Cornelius Agrippa",
  "aliases": ["Agrippa"],
  "blurb": "German polymath (1486–1535), author of De occulta philosophia.",
  "tags": ["renaissance", "magic", "kabbalah"],
  "links": [],
  "linkable": true
}
```

Valid types: `thinker` | `text` | `concept` | `tool` | `term`

Set `"linkable": false` to exclude an entity from semantic autolinking without removing it from the dataset.

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

### Editorial Overrides for Autolinking

Edit `src/lib/linkingConfig.ts` to suppress specific terms or entities from autolinking:

```typescript
// Suppress a term everywhere (e.g. "light" — too generic)
export const LINK_DENY_LIST = new Set<string>(["light", "fire"]);

// Suppress a specific entity by ID (without editing entities.json)
export const PER_RECORD_DENY = new Set<string>(["concept_matter"]);
```

---

## Semantic Autolinking Architecture

The autolinking system scans plain text and turns recognized names into interactive links. Full documentation: [`docs/semantic-linking.md`](docs/semantic-linking.md).

**Key design points:**
- **`buildLinkableIndex(data)`** — ingests entities + alchemy + topics into a single `Map<token, Target[]>`
- **Greedy longest-match** — "Corpus Hermeticum" is matched as one unit, not "Corpus" + "Hermeticum"
- **NFKC normalisation** — handles curly quotes, ligatures, accented characters
- **Stoplist** — 35+ common English words (the, is, one, all, art, …) are never linked
- **Minimum 4 characters** — single letters and short words are excluded
- **Exclusion zones** — text inside `<a>`, `<code>`, `<pre>`, and heading tags is not linkified
- **`linkable: false`** on an entity — excludes it from the index entirely
- **`LINK_DENY_LIST`** — suppress individual terms without touching source data
- **Disambiguation** — terms with multiple targets open a popover listing all candidates
- **Mobile** — first touch shows HoverCard; second touch navigates

---

## Tech Stack

| Library | Purpose |
|---------|---------|
| Vite 7 + React 19 + TypeScript | Build tooling and UI components |
| Tailwind CSS 3 | Styling with 4-theme CSS custom property system |
| React Router 7 (HashRouter) | Client-side routing compatible with GitHub Pages |
| TanStack Table | Sortable, filterable tables with CSV export |
| @xyflow/react | Interactive knowledge graph with radial layout |
| MiniSearch | Client-side full-text search across all content types |
| Prism.js | Syntax highlighting for Python, SQL, JSON |
| Zod | Runtime JSON schema validation on data load |
| Lucide React | Icon library |
| Vitest | Unit test runner (30 tests covering LinkableIndex and scanText) |
| FastAPI + uvicorn | Desktop backend (Python, local only) |
| SQLite (esoteric_archive.db) | Archive database with FTS5 full-text search |
| httpx | Async HTTP streaming to Ollama |
| PyInstaller | Packages Python backend + React frontend into Windows exe |

---

## Deployment (GitHub Pages)

Built locally, pushed to master. GitHub Actions deploys automatically.

```bash
cd cs-magical-scholarship
npm run build
git add -A && git commit -m "deploy" && git push
```

`vite.config.ts` sets `base: '/EsoPipe/'` — update this if the repository name changes. The `build:desktop` script uses `base: '/'` for local server serving and outputs to `dist-desktop/` (gitignored).

---

*Built with Claude Code · EsoPipe Studio v0.2.0*
