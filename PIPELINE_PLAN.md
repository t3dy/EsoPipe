# EsoPipe Entry Improvement Pipeline — Operational Runsheet

*Goal: Produce DGWE-quality dictionary/encyclopedia entries for all 49 entities, 50 topics, and 60 timeline events using the local Ollama model and the Gemini API.*

---

## Tonight (API reset ~midnight)

### Step 1 — Build PDF index (one-time, ~5 min)

```bash
python pdf_search.py "test" --rebuild-index
```

Scans all 459 PDFs and caches to `pdf_index_cache.json`. Only needed once.

### Step 2 — Classify PDFs (one-time, ~1 min)

```bash
python pdf_sort.py
python pdf_sort.py --interactive    # review "uncertain" ones manually
```

Produces `pdf_manifest.json`. This tells the writers which PDFs are primary sources,
secondary scholarship, or your own generated documents.

### Step 3 — Run Ollama writer (no API key needed)

While Gemini API resets, use the local model:

```bash
# Make sure Ollama is running:
ollama serve

# All entities (49 entries, ~45 min with qwen2.5:14b)
python ollama_writer.py entity --all

# All topics (50 entries, ~50 min)
python ollama_writer.py topic --all

# All timeline events (60 entries, ~60 min)
python ollama_writer.py timeline --all

# Use faster model if time-constrained:
python ollama_writer.py entity --all --model qwen2.5:7b
```

Output goes to `writing_output/entities/`, `writing_output/topics/`, `writing_output/timelines/`.

### Step 4 — Review output (15-30 min)

```bash
# Preview what will change:
python patch_entries.py --dry-run
```

Open `writing_output/` in a text editor. Delete any files that look wrong.
Common issues: too short blurb_long, hallucinated dates, wrong entity connections.

### Step 5 — Apply patches

```bash
python patch_entries.py
```

This validates word counts, removes em-dashes, and writes updated JSON files.

### Step 6 — Rebuild desktop exe

```bash
cd cs-magical-scholarship
npm run build:desktop
cd ..
python -m PyInstaller "EsoPipe Studio.spec" --noconfirm --distpath "%TEMP%\esopipe_dist"
```

Then copy the data dir (or just run the app from the dist folder to test).

---

## After Gemini API Resets (for higher-quality output)

### Step 7 — Re-run important entries with Gemini Pro

The Gemini API gives higher quality output for important entries. After midnight:

```bash
# High-priority entities with the best model:
python gemini_writer.py entity thinker_plotinus --model gemini-1.5-pro --force
python gemini_writer.py entity thinker_ficino --model gemini-1.5-pro --force
python gemini_writer.py entity thinker_hermes --model gemini-1.5-pro --force

# All topics with Flash (fast, good quality):
python gemini_writer.py topic --all --force

# Then patch again:
python patch_entries.py
```

---

## Entry Quality Targets

### Entity blurbs (all 49 entities)

| Field | Target |
|-------|--------|
| `blurb` | 60-80 words, single dense paragraph |
| `blurb_long` | 400-600 words, 4-5 paragraphs, DGWE structure |
| `tags` | 4-8 tradition tags |
| `connections` | 2-5 related entity IDs |
| `open_questions` | 1-2 sentences on scholarly debates |

### Topic entries (all 50 topics)

| Field | Target |
|-------|--------|
| `what_it_is` | 80-120 words, precise scholarly definition |
| `what_studied` | 150-250 words, specific to archive content |
| `connections` | 3-6 related topic names |
| `open_questions` | 80-130 words, real scholarly debates |
| `key_figures` | 3-6 names |
| `key_texts` | 3-6 texts with dates |
| `key_scholars` | 2-4 modern scholars with dates |

### Timeline event descriptions (all 60 events)

| Field | Target |
|-------|--------|
| `description_md` | 150-300 words, 2-3 paragraphs |
| `citations` | 1-3 citations linking to PDF sources |

---

## Longer-Term: Expanding to Thousands of Entries

The vision is a Dictionary of Gnosis and Western Esotericism-scale digital reference:

### New entity types to add

Beyond the current 49 thinkers, we need entries for:

1. **Primary texts** — *Corpus Hermeticum*, *Zohar*, *Picatrix*, *Sefer Yetzirah*, *De Occulta Philosophia*, *Enneads*, *Theologia Platonica*, *Monas Hieroglyphica*, *Splendor Solis*, *Rosarium Philosophorum*, etc. (~50 texts)

2. **Movements** — Rosicrucianism, Theosophy, Anthroposophy, Golden Dawn, Freemasonry, Martinism, etc. (~30 movements)

3. **Concepts** — Emanation, Theurgy, Sympathia, World-Soul, Spiritus Mundi, Anima Mundi, Archeus, Salt/Sulfur/Mercury (tria prima), Tree of Life, Sephiroth, Adam Kadmon, etc. (~100 concepts)

4. **More thinkers** — Suhrawardi, al-Ghazali, Moses de León, Azriel of Gerona, Pietro d'Abano, Ramón Llull, Thomas Vaughan, Robert Fludd, Thomas Taylor, Louis Claude de Saint-Martin, Martinez de Pasqually, etc. (~50 more)

5. **Modern scholars** — Wouter Hanegraaff, Antoine Faivre, Moshe Idel, Gershom Scholem, Henry Corbin, D.P. Walker, Frances Yates, Lawrence Principe, etc. (~30 scholars)

### Script to add new entities

```bash
# Add a new entity stub to entities.json, then run the writer on it
python add_entity.py "Zohar" --type text --tags kabbalah,jewish,medieval
python ollama_writer.py entity text_zohar
```

*(add_entity.py is a future script to write)*

---

## Next UI Sessions to Build

1. **Sources section on entity/topic pages** — show which chat turns and PDFs fed the Gemini output
2. **Topics → Conversations links** — "23 conversations cover this topic" with clickable list
3. **Unified archive search UI** — user-facing search showing PDF + chat results with scores
4. **Code-split the JS bundle** — current 698KB bundle should be split into per-route chunks
5. **Add typed edges to the knowledge graph** — taught, influenced, wrote, translated, critiqued

---

## Monitoring Token Usage (Gemini Free Tier)

Free tier limits: 1M tokens/day, 15 requests/minute, 1500 requests/day

Estimated usage per run:
- Each entity: ~4,000 tokens in + ~1,000 tokens out = ~5,000 total
- 49 entities × 5,000 = ~245,000 tokens ✓ (fits in 1M/day)
- 50 topics × 5,000 = ~250,000 tokens ✓
- 60 events × 3,000 = ~180,000 tokens ✓
- Total full run: ~675,000 tokens — fits within daily limit

Use `--delay 4` if hitting the 15 RPM limit (4s delay = 15 req/min).

---

*Last updated: 2026-03-07*
