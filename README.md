# EsoPipe 2.0 — Public User Guide

An Intent-Aware Scholarly Research Studio

## What Is EsoPipe?

EsoPipe 2.0 is a research and writing system built from a curated archive of scholarly AI conversations. It allows you to search, analyze, and generate structured academic content with full provenance and traceability.

The system combines keyword search, semantic embeddings, and structured generation to transform an archive into a working scholarly studio.

## What You Can Do

### 1. Search Intelligently

EsoPipe uses a hybrid search engine that combines:

*   **Keyword recall** (precise matches)
*   **Semantic similarity** (conceptual matches)
*   **Reranking** for relevance and diversity

If keyword search fails, the system automatically falls back to semantic retrieval.

### 2. Generate Structured Scholarly Outputs

EsoPipe supports several research commands:

*   `/whois <thinker>`: Generates a structured scholarly dossier with biography, context, and citations.
*   `/compare <A> <B>`: Produces an axis-based comparative analysis grounded in archival evidence.
*   `/audit <claim>`: Performs a structured argument analysis, including counterarguments and lacunae.

All outputs are schema-validated and stored as versioned artifacts.

## Provenance & Transparency

Every generated artifact includes:

*   **Source references** (typed IDs such as `turn:101`)
*   **A context snapshot** showing what the system retrieved
*   **Retrieval mode tracking** (keyword, vector, or fallback)
*   **Session logging** for reproducibility

Nothing is generated without traceable support.

## Scholarly Studio Interface

The Studio provides:

*   **Command Palette** with real-time intent prediction
*   **Relational Sidecar** showing related thinkers, tables, and discussions
*   **Retrieval Debugger** displaying ranking scores and context packaging
*   **Scholarly Library** for browsing generated artifacts

## Evaluation & Quality

The retrieval engine is benchmarked using gold queries. Current performance:

*   **Recall@10**: 66.67%
*   **MRR**: 0.091
*   **Average retrieval latency**: ~12 ms

These metrics are continuously evaluated as the system scales.

## Intended Audience

EsoPipe is designed for:

*   Scholars and students
*   Digital humanities researchers
*   Independent intellectuals
*   Creators building educational, editorial, or interpretive products

## How to Run EsoPipe 2.0 Locally

Because EsoPipe 2.0 uses a full Python backend and a SQLite database to power its semantic search and generated artifacts, it must be run locally on your machine rather than as a static website. 

### Prerequisites
*   [Python 3.9+](https://www.python.org/downloads/)
*   [Node.js](https://nodejs.org/en)

### Step 1: Clone and Start the Backend Server

Open your terminal and clone the repository:
```bash
git clone https://github.com/t3dy/EsoPipe.git
cd EsoPipe
```

Start the FastAPI backend (which loads the `esoteric_archive.db` and the Intent Router):
```bash
pip install fastapi uvicorn sqlite3 numpy
python -m esopipe2.server
```
*The server will start on `http://localhost:8000`.*

### Step 2: Start the Scholarly Studio Frontend

Open a **second, separate terminal window** and navigate to the `studio` folder:
```bash
cd EsoPipe/studio
npm install
npm run dev
```
*The React studio will automatically open in your browser at `http://localhost:5173`.*

---

## What Makes It Different

*   Hybrid semantic + keyword retrieval
*   Structured, schema-bound outputs
*   Full provenance tracking
*   Intent-aware routing
*   Artifact versioning

EsoPipe is not a chatbot. It is a reproducible scholarly production system.
