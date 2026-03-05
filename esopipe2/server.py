from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
import sqlite3
import json
import os
import sys
import shutil
import httpx
from typing import List, Dict, Any, Optional
from esopipe2.retrieval import HybridRetriever, pack_context
from esopipe2.router import IntentRouter
from esopipe2.sidecar import RelationalSidecar
from esopipe2.commands import CommandProcessor
from pydantic import BaseModel

def get_app_data_dir():
    app_data = os.getenv('LOCALAPPDATA', os.path.expanduser('~'))
    eso_dir = os.path.join(app_data, "EsoPipe2")
    os.makedirs(eso_dir, exist_ok=True)
    return eso_dir

def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

is_frozen = getattr(sys, 'frozen', False)
DB_FILENAME = "esoteric_archive.db"
CENTROIDS_FILENAME = "intent_centroids.json"

if is_frozen:
    os.environ["IS_FROZEN"] = "1"
    app_data_dir = get_app_data_dir()
    DB_PATH = os.path.join(app_data_dir, DB_FILENAME)
    CENTROIDS_PATH = os.path.join(app_data_dir, CENTROIDS_FILENAME)

    if not os.path.exists(DB_PATH):
        source_db = resource_path(DB_FILENAME)
        if os.path.exists(source_db):
            shutil.copy2(source_db, DB_PATH)

    if not os.path.exists(CENTROIDS_PATH):
        source_centroids = resource_path(CENTROIDS_FILENAME)
        if os.path.exists(source_centroids):
            shutil.copy2(source_centroids, CENTROIDS_PATH)
else:
    DB_PATH = os.path.abspath(DB_FILENAME)
    CENTROIDS_PATH = os.path.abspath(CENTROIDS_FILENAME)

OLLAMA_BASE = "http://localhost:11434"

app = FastAPI(title="EsoPipe 2.0 Studio Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

retriever = HybridRetriever(DB_PATH)
router = IntentRouter(DB_PATH, retriever)
sidecar = RelationalSidecar(DB_PATH, retriever)
processor = CommandProcessor(DB_PATH)

# ── Pydantic models ───────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    query: str
    intent: str

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None
    model: str = "qwen2.5:14b"
    use_retrieval: bool = True
    history: List[Dict[str, str]] = []  # [{role, content}, ...]

# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    router.train()

# ── Core endpoints ────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/intent/predict")
async def predict_intent(q: str = Query(...)):
    intent, score = router.predict(q)
    return {"intent": intent, "score": score}

@app.post("/generate")
async def generate_artifact(req: GenerateRequest):
    q = req.query
    intent = req.intent

    if intent == "whois":
        aid = processor.execute_whois(q)
    elif intent == "compare":
        parts = q.lower().replace("compare", "").split(" and ")
        if len(parts) >= 2:
            aid = processor.execute_compare(parts[0].strip(), parts[1].strip())
        else:
            aid = processor.execute_compare(q, "Unknown")
    elif intent == "audit":
        aid = processor.execute_audit(q)
    else:
        aid = processor.execute_whois(q)

    if aid:
        return {"status": "success", "artifact_id": aid}
    return {"status": "error"}

@app.get("/artifacts")
async def get_artifacts(limit: int = 10):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT id, type, schema_version, payload_json FROM artifacts ORDER BY rowid DESC LIMIT ?",
        (limit,)
    ).fetchall()
    res = []
    for r in rows:
        res.append({
            "id": r['id'],
            "type": r['type'],
            "version": r['schema_version'],
            "payload": json.loads(r['payload_json'])
        })
    conn.close()
    return res

@app.get("/sidecar")
async def get_sidecar(artifact_id: str):
    related = sidecar.get_related_context(artifact_id)
    return related

# ── Conversations ─────────────────────────────────────────────────────────────

@app.get("/conversations")
async def list_conversations(
    q: str = Query(None),
    limit: int = 200,
    offset: int = 0,
):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    if q:
        fts_q = q.replace("'", "''").replace(".", " ").replace(",", " ").replace("?", " ")
        try:
            rows = conn.execute("""
                SELECT DISTINCT c.id, c.title, c.date, c.model, c.turn_count
                FROM conversations c
                JOIN turns t ON t.conversation_id = c.id
                JOIN turns_fts f ON t.id = f.rowid
                WHERE turns_fts MATCH ?
                ORDER BY c.date DESC
                LIMIT ? OFFSET ?
            """, (fts_q, limit, offset)).fetchall()
        except Exception:
            # Fallback to title LIKE search
            rows = conn.execute("""
                SELECT id, title, date, model, turn_count
                FROM conversations WHERE title LIKE ?
                ORDER BY date DESC LIMIT ? OFFSET ?
            """, (f"%{q}%", limit, offset)).fetchall()
    else:
        rows = conn.execute("""
            SELECT id, title, date, model, turn_count
            FROM conversations
            ORDER BY date DESC
            LIMIT ? OFFSET ?
        """, (limit, offset)).fetchall()

    conv_ids = [r['id'] for r in rows]
    wc_map = {}
    if conv_ids:
        placeholders = ",".join("?" * len(conv_ids))
        wc_rows = conn.execute(
            f"SELECT conversation_id, SUM(word_count) as wc FROM turns "
            f"WHERE conversation_id IN ({placeholders}) GROUP BY conversation_id",
            conv_ids
        ).fetchall()
        wc_map = {r['conversation_id']: r['wc'] or 0 for r in wc_rows}

    result = [{
        "id": r['id'],
        "title": r['title'] or "(untitled)",
        "date": r['date'] or "",
        "model": r['model'] or "",
        "turn_count": r['turn_count'] or 0,
        "word_count": wc_map.get(r['id'], 0),
    } for r in rows]
    conn.close()
    return result

@app.get("/conversations/{conv_id}")
async def get_conversation(conv_id: int):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conv = conn.execute(
        "SELECT id, title, date, model FROM conversations WHERE id = ?", (conv_id,)
    ).fetchone()
    if not conv:
        conn.close()
        raise HTTPException(status_code=404, detail="Conversation not found")
    turns = conn.execute("""
        SELECT id, turn_index, role, content, word_count
        FROM turns
        WHERE conversation_id = ? AND role != 'tool'
        ORDER BY turn_index
    """, (conv_id,)).fetchall()
    result = dict(conv)
    result['turns'] = [dict(t) for t in turns]
    conn.close()
    return result

# ── Alchemy ───────────────────────────────────────────────────────────────────

@app.get("/alchemy/search")
async def search_alchemy(q: str = Query(...), limit: int = 20):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("""
        SELECT a.id, a.term, a.category, a.definition, a.body
        FROM alchemy_concepts a
        JOIN alchemy_concepts_fts f ON a.rowid = f.rowid
        WHERE alchemy_concepts_fts MATCH ?
        ORDER BY rank
        LIMIT ?
    """, (q, limit)).fetchall()

    res = []
    for r in rows:
        images = conn.execute(
            "SELECT image_path, caption FROM alchemy_images WHERE concept_id = ?", (r['id'],)
        ).fetchall()
        res.append({
            "id": r['id'], "term": r['term'], "category": r['category'],
            "definition": r['definition'], "body": r['body'],
            "images": [{"path": i["image_path"], "caption": i["caption"]} for i in images]
        })
    conn.close()
    return res

@app.get("/alchemy/random")
async def random_alchemy(limit: int = 15):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("""
        SELECT id, term, category, definition, body
        FROM alchemy_concepts
        ORDER BY RANDOM()
        LIMIT ?
    """, (limit,)).fetchall()

    res = []
    for r in rows:
        images = conn.execute(
            "SELECT image_path, caption FROM alchemy_images WHERE concept_id = ?", (r['id'],)
        ).fetchall()
        if not images:
            images = conn.execute(
                "SELECT image_path, caption FROM alchemy_images ORDER BY RANDOM() LIMIT 1"
            ).fetchall()
        res.append({
            "id": r['id'], "term": r['term'], "category": r['category'],
            "definition": r['definition'], "body": r['body'],
            "images": [{"path": i["image_path"], "caption": i["caption"]} for i in images]
        })
    conn.close()
    return res

# ── LLM / Ollama ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a scholarly research assistant specialising in esoteric studies: alchemy, Neoplatonism, Renaissance magic, Kabbalah, Hermeticism, and related traditions. You have access to an archive of research conversations.

When answering:
- Draw directly on the archival context provided between XML tags
- Be precise; cite the tradition, text, or thinker you draw from
- Note where evidence is ambiguous or contested
- Keep answers focused; use markdown headers for long answers"""

@app.get("/llm/status")
async def llm_status():
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(f"{OLLAMA_BASE}/api/tags")
            data = r.json()
            models = [m['name'] for m in data.get('models', [])]
            return {"running": True, "models": models}
    except Exception:
        return {"running": False, "models": []}

@app.post("/llm/chat")
async def llm_chat(req: ChatRequest):
    # Retrieval context from the archive
    context_block = ""
    if req.use_retrieval and req.message.strip():
        bundle = retriever.search(req.message, limit=8)
        if bundle['results']:
            context_block = "\n\n### Archival Context\n" + pack_context(bundle['results'])

    # If a conversation is pinned, include a window of its turns
    conv_block = ""
    if req.conversation_id:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        turns = conn.execute("""
            SELECT role, content FROM turns
            WHERE conversation_id = ? AND role != 'tool'
            ORDER BY turn_index LIMIT 20
        """, (req.conversation_id,)).fetchall()
        conv_title = conn.execute(
            "SELECT title FROM conversations WHERE id = ?", (req.conversation_id,)
        ).fetchone()
        conn.close()
        if turns:
            label = conv_title['title'] if conv_title else f"Conversation {req.conversation_id}"
            conv_lines = [f"[{t['role'].upper()}]: {(t['content'] or '')[:500]}" for t in turns]
            conv_block = f"\n\n### Pinned Conversation: {label}\n" + "\n\n".join(conv_lines)

    system_content = SYSTEM_PROMPT + context_block + conv_block

    messages = [{"role": "system", "content": system_content}]
    for h in req.history[-10:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": req.message})

    async def stream_ollama():
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream("POST", f"{OLLAMA_BASE}/api/chat", json={
                    "model": req.model,
                    "messages": messages,
                    "stream": True,
                }) as response:
                    async for line in response.aiter_lines():
                        if line.strip():
                            try:
                                chunk = json.loads(line)
                                content = chunk.get("message", {}).get("content", "")
                                if content:
                                    yield content
                                if chunk.get("done"):
                                    break
                            except json.JSONDecodeError:
                                pass
        except httpx.ConnectError:
            yield "\n\n*[Ollama is not running — start it with `ollama serve`]*"
        except Exception as e:
            yield f"\n\n*[Error: {e}]*"

    return StreamingResponse(stream_ollama(), media_type="text/plain")

# ── Serve React App (must be last) ────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

dist_path = resource_path(os.path.join("studio", "dist"))
if os.path.exists(dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        path = os.path.join(dist_path, full_path)
        if os.path.exists(path) and os.path.isfile(path):
            return FileResponse(path)
        return FileResponse(os.path.join(dist_path, "index.html"))
