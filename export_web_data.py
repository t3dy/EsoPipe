"""
export_web_data.py
Exports SQLite data to JSON files for the EsoPipe static website.
Run from the repo root: python export_web_data.py
"""
import json, os, re, sqlite3
from collections import defaultdict

DB = "E:/pdf/esoteric studies chats/esoteric_archive.db"
OUT = "E:/pdf/esoteric studies chats/cs-magical-scholarship/public/data"

os.makedirs(f"{OUT}/conversations", exist_ok=True)

con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row

# ── 1. Conversations metadata ─────────────────────────────────────────────────
print("Exporting conversations metadata…")

# Gather per-conversation entity_ids and request_types from turns
turn_rows = con.execute("""
    SELECT conversation_id, request_types, entity_ids
    FROM turns WHERE role != 'tool'
""").fetchall()

conv_entities = defaultdict(set)
conv_rtypes   = defaultdict(set)
conv_wc       = defaultdict(int)

for row in turn_rows:
    cid = row["conversation_id"]
    if row["entity_ids"]:
        try:
            for eid in json.loads(row["entity_ids"]):
                if eid:
                    conv_entities[cid].add(eid)
        except Exception:
            pass
    if row["request_types"]:
        try:
            for rt in json.loads(row["request_types"]):
                if rt:
                    conv_rtypes[cid].add(rt)
        except Exception:
            pass

# Word counts per conversation
for row in con.execute("SELECT conversation_id, SUM(word_count) as wc FROM turns GROUP BY conversation_id"):
    conv_wc[row["conversation_id"]] = row["wc"] or 0

conversations = []
for c in con.execute("SELECT id, title, date, model, turn_count FROM conversations ORDER BY date DESC, title"):
    cid = c["id"]
    conversations.append({
        "id":           cid,
        "title":        c["title"] or "(untitled)",
        "date":         c["date"] or "",
        "model":        c["model"] or "",
        "turn_count":   c["turn_count"] or 0,
        "word_count":   conv_wc.get(cid, 0),
        "entity_ids":   sorted(conv_entities.get(cid, [])),
        "request_types": sorted(conv_rtypes.get(cid, [])),
    })

with open(f"{OUT}/conversations.json", "w", encoding="utf-8") as f:
    json.dump(conversations, f, ensure_ascii=False, separators=(",", ":"))
print(f"  → {len(conversations)} conversations")

# ── 2. Per-conversation turn files ────────────────────────────────────────────
print("Exporting per-conversation turn files…")

conv_map = {c["id"]: c for c in con.execute("SELECT id, title, date FROM conversations")}

# Group turns by conversation
all_turns = con.execute("""
    SELECT id, conversation_id, turn_index, role, content, word_count, request_types
    FROM turns
    WHERE role != 'tool'
    ORDER BY conversation_id, turn_index
""").fetchall()

grouped = defaultdict(list)
for t in all_turns:
    grouped[t["conversation_id"]].append(t)

for cid, turns in grouped.items():
    c = conv_map.get(cid)
    payload = {
        "id":    cid,
        "title": c["title"] if c else "(untitled)",
        "date":  c["date"]  if c else "",
        "turns": []
    }
    for t in turns:
        rts = []
        if t["request_types"]:
            try:
                rts = json.loads(t["request_types"])
            except Exception:
                pass
        payload["turns"].append({
            "id":            t["id"],
            "turn_index":    t["turn_index"],
            "role":          t["role"],
            "content":       t["content"] or "",
            "word_count":    t["word_count"] or 0,
            "request_types": rts,
        })
    with open(f"{OUT}/conversations/{cid}.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

print(f"  → {len(grouped)} conversation files")

# ── 3. Entity details (related conversations + co-entities) ───────────────────
print("Exporting entity details…")

# entity_id → set of conversation_ids
entity_convs = defaultdict(set)
for row in con.execute("SELECT entity_id, conversation_id FROM entity_mentions"):
    entity_convs[row["entity_id"]].add(row["conversation_id"])

# entity_id → mention count
entity_mentions_count = defaultdict(int)
for row in con.execute("SELECT entity_id, COUNT(*) as cnt FROM entity_mentions GROUP BY entity_id"):
    entity_mentions_count[row["entity_id"]] = row["cnt"]

# co-occurrence: for each entity, which other entities appear in same conversations
entity_co = defaultdict(lambda: defaultdict(int))
for cid, eids in conv_entities.items():
    eid_list = list(eids)
    for i, a in enumerate(eid_list):
        for b in eid_list[i+1:]:
            entity_co[a][b] += 1
            entity_co[b][a] += 1

entity_details = {}
for eid in entity_convs:
    cids = sorted(entity_convs[eid])
    co = sorted(entity_co[eid].items(), key=lambda x: -x[1])[:10]
    entity_details[eid] = {
        "conversation_ids":  cids,
        "mention_count":     entity_mentions_count[eid],
        "co_entities": [{"id": co_id, "shared": n} for co_id, n in co],
    }

with open(f"{OUT}/entity_details.json", "w", encoding="utf-8") as f:
    json.dump(entity_details, f, ensure_ascii=False, separators=(",", ":"))
print(f"  → {len(entity_details)} entities with details")

# ── 4. Alchemy concepts ───────────────────────────────────────────────────────
print("Exporting alchemy concepts…")

CATEGORY_MAP = {
    "chemical process":              "Chemical Process",
    "chemical process/symbolic stage": "Chemical Process",
    "symbolic imagery/process":      "Chemical Process",
    "process":                       "Chemical Process",
    "operations":                    "Operation",
    "operation":                     "Operation",
    "theoretical framework":         "Theoretical Framework",
    "theoretical framework/concept": "Theoretical Framework",
    "concept":                       "Concept",
    "symbol":                        "Symbol",
    "symbol / substance":            "Symbol",
    "symbolic framework":            "Symbol",
    "metaphor":                      "Symbol",
    "substance":                     "Substance",
    "apparatus":                     "Apparatus",
    "alchemical stage":              "Stage",
    "stage":                         "Stage",
    "practitioner":                  "Practitioner",
    "uncategorized":                 "Uncategorized",
    "":                              "Uncategorized",
}

concepts = []
for row in con.execute("SELECT id, term, category, definition, body FROM alchemy_concepts ORDER BY term"):
    raw_cat = (row["category"] or "").strip().lower()
    norm_cat = CATEGORY_MAP.get(raw_cat, row["category"] or "Uncategorized")
    concepts.append({
        "id":         row["id"],
        "term":       row["term"],
        "category":   norm_cat,
        "definition": row["definition"] or "",
        "body":       row["body"] or "",
    })

with open(f"{OUT}/alchemy_concepts.json", "w", encoding="utf-8") as f:
    json.dump(concepts, f, ensure_ascii=False, separators=(",", ":"))
print(f"  → {len(concepts)} alchemy concepts")

# ── 5. Topics JSON (parse TOPIC_DISTILLATION.md) ──────────────────────────────
print("Parsing topic distillation…")

MD = "E:/pdf/esoteric studies chats/TOPIC_DISTILLATION.md"
with open(MD, encoding="utf-8") as f:
    text = f.read()

# Split into topic blocks
topic_blocks = re.split(r'\n## (\d+)\. (.+?)\n', text)
# topic_blocks[0] = preamble, then triplets: (rank_str, name, body)

topics = []
i = 1
while i + 2 < len(topic_blocks):
    rank_str = topic_blocks[i].strip()
    name     = topic_blocks[i+1].strip()
    body     = topic_blocks[i+2]
    i += 3

    # Extract metadata line e.g. "*Concept · 3,618 mentions · 187 conversations*"
    meta_match = re.search(r'\*(.+?)\*', body)
    meta_type = meta_match.group(1) if meta_match else ""

    def extract_section(heading, text):
        m = re.search(rf'### {re.escape(heading)}\n(.*?)(?=\n### |\n---|\Z)', text, re.DOTALL)
        return m.group(1).strip() if m else ""

    what_it_is   = extract_section("What it is",  body) or extract_section("What they are", body) or extract_section("What it is", body)
    what_studied = extract_section("What you've studied", body) or extract_section("What you've studied", body)
    connections_raw = extract_section("Key connections", body)
    open_q       = extract_section("Open questions", body)

    # Parse connection links e.g. "→ [Plotinus](#15-plotinus), ..."
    conn_links = re.findall(r'\[([^\]]+)\]\(#[^\)]+\)', connections_raw)

    topics.append({
        "rank":          int(rank_str),
        "name":          name,
        "meta":          meta_type,
        "what_it_is":    what_it_is,
        "what_studied":  what_studied,
        "connections":   conn_links,
        "open_questions": open_q,
    })

with open(f"{OUT}/topics.json", "w", encoding="utf-8") as f:
    json.dump(topics, f, ensure_ascii=False, separators=(",", ":"))
print(f"  → {len(topics)} topics")

# ── 6. Search corpus ──────────────────────────────────────────────────────────
print("Exporting search corpus…")

# Lightweight: conversation title + first user message excerpt
first_user = {}
for row in con.execute("""
    SELECT conversation_id, content FROM turns
    WHERE role='user' AND turn_index=(
        SELECT MIN(turn_index) FROM turns t2
        WHERE t2.conversation_id=turns.conversation_id AND t2.role='user'
    )
"""):
    first_user[row["conversation_id"]] = (row["content"] or "")[:300]

search_corpus = []
for c in conversations:
    search_corpus.append({
        "id":      f"conv_{c['id']}",
        "type":    "conversation",
        "title":   c["title"],
        "excerpt": first_user.get(c["id"], ""),
        "tags":    c["entity_ids"][:6],
        "href":    f"/conversations/{c['id']}",
    })

# Add alchemy concepts to search
for ac in concepts:
    search_corpus.append({
        "id":      f"alch_{ac['id']}",
        "type":    "alchemy",
        "title":   ac["term"],
        "excerpt": ac["definition"][:200],
        "tags":    [ac["category"]],
        "href":    f"/alchemy#{ac['id']}",
    })

with open(f"{OUT}/search_corpus.json", "w", encoding="utf-8") as f:
    json.dump(search_corpus, f, ensure_ascii=False, separators=(",", ":"))
print(f"  → {len(search_corpus)} search items")

con.close()
print("\nAll exports complete.")
