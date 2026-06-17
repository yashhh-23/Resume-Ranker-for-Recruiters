import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from ranker import parse_jd_text, rank_candidates
from ranker.candidate_scorer import WEIGHTS
from ranker.embedding_utils import load_model
from ranker.validators import sanitize_candidates

_START_TIME = time.time()
MAX_CANDIDATES = 1000

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up model on startup
    import asyncio
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, load_model)
    print("[RRR] Model loaded and ready.")
    yield

app = FastAPI(title="RRR Resume Ranker Backend", lifespan=lifespan)

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

app.add_middleware(RequestIDMiddleware)

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "RRR_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,https://*.vercel.app",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization", "X-Request-ID"],
)


class RankRequest(BaseModel):
    job_description: str
    candidates: List[Dict[str, Any]]


@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "RRR Resume Ranker",
        "message": "Use GET /health, POST /rank, or open /docs for the API explorer.",
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "RRR Resume Ranker Backend",
        "version": "1.0.0",
        "model": "sentence-transformers/all-MiniLM-L6-v2",
        "uptime_seconds": round(time.time() - _START_TIME),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/rank")
async def rank(req: RankRequest):
    if not req.job_description.strip():
        raise HTTPException(status_code=400, detail="job_description is required")
    if not req.candidates:
        raise HTTPException(status_code=400, detail="candidates array is required")
    if len(req.candidates) > MAX_CANDIDATES:
        raise HTTPException(
            status_code=422,
            detail=f"Too many candidates: {len(req.candidates)} exceeds limit of {MAX_CANDIDATES}. "
                   f"Use the standalone rank.py script for larger batches."
        )

    t0 = time.perf_counter()
    valid_candidates, skipped = sanitize_candidates(req.candidates)
    jd = parse_jd_text(req.job_description)
    ranked = rank_candidates(valid_candidates, jd, limit=100)
    elapsed_ms = round((time.perf_counter() - t0) * 1000)

    return {
        "ranked_candidates": ranked,
        "skipped_candidates": len(skipped),
        "total_candidates": len(req.candidates),
        "ranked_count": len(ranked),
        "processing_time_ms": elapsed_ms,
        "jd_metadata": jd,
        "scoring_model": {
            "name": "semantic_weighted_v1",
            "weights": WEIGHTS,
            "model_id": "sentence-transformers/all-MiniLM-L6-v2",
        },
    }
