# EsoPipe — CS for Magical Scholarship

A hands-on CS curriculum for researchers who want to build data pipelines for esoteric studies research. Teaches schema design, LLM prompt engineering, and knowledge graph traversal — with Neoplatonism as the worked example.

**Live demo:** https://t3dy.github.io/EsoPipe/

---

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173/EsoPipe/ (or the URL shown in terminal)

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build locally |

---

## Adding Content

All data lives in `/public/data/` as plain JSON files. Edit them directly — the app validates on load and shows errors for any invalid items. See the **Schema** page in the app for full field documentation.

### Add an Entity

Edit `public/data/entities.json`:

```json
{
  "id": "thinker_agrippa",
  "type": "thinker",
  "label": "Heinrich Cornelius Agrippa",
  "aliases": ["Agrippa"],
  "blurb": "German polymath (1486–1535), author of De occulta philosophia...",
  "tags": ["renaissance", "magic", "kabbalah"],
  "links": []
}
```

**ID convention:** `{type}_{snake_case}` — e.g. `thinker_ficino`, `concept_emanation`

**Valid types:** `thinker` | `text` | `concept` | `tool` | `term`

### Add an Edge

Edit `public/data/edges.json`:

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

**Valid edge types:** `uses` | `explains` | `compares` | `derived-from` | `mentions`

**Weight:** 1–3 controls edge thickness in the graph view.

### Add a Timeline Event

Edit `public/data/timelines.json`, add to an existing timeline's `events` array:

```json
{
  "id": "time_007",
  "timeline_id": "timeline_neoplatonism_transmission",
  "start": "1486",
  "end": null,
  "title": "Agrippa writes De occulta philosophia (1486)",
  "tags": ["renaissance", "magic"],
  "related_entities": ["thinker_agrippa"],
  "description_md": "Agrippa completes the first version of **De occulta philosophia**...",
  "citations": []
}
```

**Date format:** 4-digit year string. Displayed as `c. YYYY`.

### Add a Lesson

Edit `public/data/lessons.json`. Minimal stub:

```json
{
  "id": "lesson_vector_search",
  "title": "Vector Search for Manuscript Archives",
  "summary": "Use embeddings to find semantically similar passages.",
  "difficulty": "intermediate",
  "estimated_time": "45 min",
  "tags": ["nlp", "search", "python"],
  "cs_concepts": [{ "name": "Embeddings", "notes": "Dense vector representations..." }],
  "scholarly_application": { "domain": "Esoteric Studies", "notes": "..." },
  "sections": [],
  "code_snippets": [],
  "exercises": [],
  "related_entities": []
}
```

---

## Themes

Choose from four themes via the dropdown in the top bar:

| Theme | Description |
|-------|-------------|
| **Parchment** | Warm ochre tones, ink-brown text, gold accents |
| **Dark Academia** | Deep charcoal, cream text, crimson accents |
| **Academic Journal** | Clean white, system sans-serif, navy blue |
| **⌘ Mac Classic** | Black & white, Chicago font, System 7 aesthetic |

Theme is saved to `localStorage` across sessions.

---

## Deployment (GitHub Pages)

```bash
npm run build
# Push dist/ to gh-pages branch or use GitHub Actions
```

`vite.config.ts` sets `base: '/EsoPipe/'` — update if your repo name differs.

**GitHub Actions workflow** (`.github/workflows/deploy.yml`):

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

## Tech Stack

| Library | Purpose |
|---------|---------|
| Vite + React + TypeScript | Build tooling and components |
| Tailwind CSS | Utility-first styling + 4-theme CSS custom properties |
| React Router (HashRouter) | Client-side routing, works on GitHub Pages |
| TanStack Table | Sortable, filterable tables with CSV export |
| @xyflow/react | Interactive knowledge graph canvas |
| MiniSearch | Client-side full-text search |
| Prism.js | Syntax highlighting for Python, SQL, JSON, Bash |
| Zod | Runtime validation of all JSON data |
| Lucide React | Icons |

---

## Project Philosophy

EsoPipe is built around the idea that scholarly research and software engineering are the same activity at different levels of abstraction. When you ask an AI to produce an analytical table about Ikhwan al-Safa and then refine the prompt to add historiographical questions — that *is* iterative schema design. The lessons make that connection explicit.

*Built with Claude Code · EsoPipe v0.1.0-alpha*
