from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import json
from typing import List, Dict, Any
from esopipe2.retrieval import HybridRetriever
from esopipe2.router import IntentRouter
from esopipe2.sidecar import RelationalSidecar

app = FastAPI(title="EsoPipe 2.0 Studio Backend")

# Allow CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "esoteric_archive.db"
retriever = HybridRetriever(DB_PATH)
router = IntentRouter(DB_PATH, retriever)
sidecar = RelationalSidecar(DB_PATH, retriever)

@app.on_event("startup")
async def startup_event():
    router.train()

@app.get("/intent/predict")
async def predict_intent(q: str = Query(...)):
    intent, score = router.predict(q)
    return {"intent": intent, "score": score}

@app.get("/artifacts")
async def get_artifacts(limit: int = 10):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT id, type, schema_version, payload_json FROM artifacts ORDER BY rowid DESC LIMIT ?", (limit,)).fetchall()
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
