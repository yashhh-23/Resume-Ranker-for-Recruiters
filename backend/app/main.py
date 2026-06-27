import asyncio
import json
import logging
import os
import time
import traceback
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.middleware.gzip import GZipMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from ranker import parse_jd_text, rank_candidates
from ranker.candidate_scorer import WEIGHTS
from ranker.signal_scorer import SIGNAL_WEIGHTS
from ranker.embedding_utils import load_model
from ranker.validators import sanitize_candidates

limiter = Limiter(key_func=get_remote_address)

_START_TIME = time.time()
MAX_CANDIDATES = 1000
_MODEL_READY = False
_GIT_SHA = os.getenv("GIT_SHA", "unknown")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _MODEL_READY
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, load_model)
        _MODEL_READY = True
        print(f"[RRR] Model loaded and ready. Commit SHA: {_GIT_SHA}")
    except Exception as e:
        print(f"[RRR] WARNING: Model warm-up failed: {e}")
    yield


app = FastAPI(
    title="RRR Resume Ranker Backend",
    lifespan=lifespan,
    docs_url="/docs" if os.getenv("ENV", "development") != "production" else None,
    redoc_url="/redoc" if os.getenv("ENV", "development") != "production" else None,
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "path": str(request.url.path),
        },
    )


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded. Please try again later.",
            "status_code": 429,
            "path": str(request.url.path),
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):

    logging.error(f"Unhandled error on {request.url.path}: {traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error. Please try again.",
            "status_code": 500,
            "request_id": getattr(request.state, "request_id", "unknown"),
        },
    )


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
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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


@app.get("/weights")
@limiter.limit("30/minute")
async def get_weights(request: Request):
    return {
        "overall_weights": WEIGHTS,
        "signal_weights": SIGNAL_WEIGHTS,
    }


@app.get("/health")
async def health():
    return {
        "status": "ok" if _MODEL_READY else "degraded",
        "model_ready": _MODEL_READY,
        "service": "RRR Resume Ranker Backend",
        "version": "1.0.0",
        "commit_hash": _GIT_SHA,
        "model": "sentence-transformers/all-MiniLM-L6-v2",
        "uptime_seconds": round(time.time() - _START_TIME),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _build_rank_response(
    ranked,
    skipped,
    all_candidates_len,
    valid_candidates_len,
    elapsed_ms,
    jd,
    truncated: bool = False,
):
    response = {
        "ranked_candidates": ranked,
        "skipped_candidates": {
            "count": len(skipped),
            "entries": skipped,
            "reason": "Failed data validation / sanitization",
        },
        "total_candidates": all_candidates_len,
        "valid_candidates": valid_candidates_len,
        "scored_candidates": valid_candidates_len,
        "ranking_cap": 100,
        "candidates_scored_but_not_returned": max(
            0, valid_candidates_len - len(ranked)
        ),
        "ranked_count": len(ranked),
        "processing_time_ms": elapsed_ms,
        "jd_parsed": {
            "required_skills": jd.get("required_skills", []),
            "preferred_skills": jd.get("preferred_skills", []),
            "target_title": jd.get("target_title", ""),
            "min_experience_years": jd.get("min_experience_years", 0),
            "target_industry": jd.get("target_industry", ""),
            "target_field": jd.get("target_field", ""),
            "seniority_level": jd.get("seniority_level", "mid"),
            "salary_min": jd.get("salary_min", 0.0),
            "salary_max": jd.get("salary_max", 0.0),
        },
        "scoring_model": {
            "name": "semantic_hybrid_weighted_v1",
            "description": "5-signal weighted: semantic cosine (FAISS) + rule-based heuristics",
            "weights": WEIGHTS,
            "model_id": "sentence-transformers/all-MiniLM-L6-v2",
        },
    }
    if truncated:
        response["warning"] = (
            f"Input contained more than {MAX_CANDIDATES} candidates. "
            f"Only the first {MAX_CANDIDATES} were scored. "
            f"Use rank.py CLI for larger batches."
        )
    if os.getenv("ENV", "development") != "production":
        response["jd_debug"] = jd
    return response


RANK_RATE_LIMIT = os.getenv("RANK_RATE_LIMIT", "30/minute")


@app.post("/rank")
@limiter.limit(RANK_RATE_LIMIT)
async def rank(request: Request, req: RankRequest):
    if not req.job_description.strip():
        raise HTTPException(status_code=400, detail="job_description is required")
    if not req.candidates:
        raise HTTPException(status_code=400, detail="candidates array is required")
    if len(req.candidates) > MAX_CANDIDATES:
        raise HTTPException(
            status_code=422,
            detail=f"Too many candidates: {len(req.candidates)} exceeds limit of {MAX_CANDIDATES}. "
            f"Use the standalone rank.py script for larger batches.",
        )

    t0 = time.perf_counter()
    valid_candidates, skipped = sanitize_candidates(req.candidates)
    jd = parse_jd_text(req.job_description)
    ranked = rank_candidates(valid_candidates, jd, limit=100)
    elapsed_ms = round((time.perf_counter() - t0) * 1000)

    return _build_rank_response(
        ranked, skipped, len(req.candidates), len(valid_candidates), elapsed_ms, jd
    )


@app.post("/rank/upload")
@limiter.limit(RANK_RATE_LIMIT)
async def rank_upload(
    request: Request,
    job_description: str = Form(...),
    candidates_file: UploadFile = File(...),
):
    allowed_types = {".json", ".jsonl"}
    filename = candidates_file.filename or ""
    ext = os.path.splitext(filename)[-1].lower()
    if ext not in allowed_types:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type '{ext}'. Use .json or .jsonl",
        )

    content = await candidates_file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Max 10MB.")

    content_str = content.decode("utf-8").strip()
    if ext == ".json":
        try:
            parsed = json.loads(content_str)
            candidates = parsed if isinstance(parsed, list) else [parsed]
        except json.JSONDecodeError:
            raise HTTPException(status_code=422, detail="Invalid JSON in uploaded file")
    else:  # .jsonl
        candidates = []
        for line in content_str.splitlines():
            line = line.strip()
            if line:
                try:
                    candidates.append(json.loads(line))
                    if len(candidates) >= MAX_CANDIDATES:
                        break
                except json.JSONDecodeError:
                    continue

    original_len = len(candidates)
    truncated = original_len > MAX_CANDIDATES
    if truncated:
        candidates = candidates[:MAX_CANDIDATES]

    if not job_description.strip():
        raise HTTPException(status_code=400, detail="job_description is required")
    if not candidates:
        raise HTTPException(
            status_code=400, detail="candidates array is empty or invalid"
        )

    t0 = time.perf_counter()
    valid_candidates, skipped = sanitize_candidates(candidates)
    jd = parse_jd_text(job_description)
    ranked = rank_candidates(valid_candidates, jd, limit=100)
    elapsed_ms = round((time.perf_counter() - t0) * 1000)

    return _build_rank_response(
        ranked, skipped, original_len, len(valid_candidates), elapsed_ms, jd, truncated
    )


@app.get("/info")
async def info():
    return {
        "project": "RRR — Resume Ranker for Recruiters",
        "team": "Team Chanakya",
        "hackathon": "Redrob H2S",
        "scoring_model": {
            "name": "semantic_hybrid_weighted_v1",
            "description": "5-signal weighted: semantic cosine (FAISS) + rule-based heuristics",
            "weights": WEIGHTS,
            "model_id": "sentence-transformers/all-MiniLM-L6-v2",
        },
        "vector_index": "FAISS (CPU flat L2)",
        "framework": "FastAPI",
        "deployment": "HuggingFace Spaces (CPU Docker)",
        "scoring_signals": {
            "skill_match": "35% — semantic cosine + coverage + endorsements",
            "career_fit": "25% — title/industry text match + experience decay",
            "signal_modifier": "15% — GitHub, response rate, assessments, salary fit",
            "education": "15% — degree tier × field match × degree level",
            "availability": "10% — notice period, open_to_work, relocation",
        },
        "hallucination_free": True,
        "reasoning_methodology": (
            "All candidate reasoning strings are generated deterministically from "
            "structured data fields (skills, career_history, education, redrob_signals). "
            "No language model is invoked for reasoning generation. "
            "Scores are computed via weighted cosine similarity + rule-based heuristics."
        ),
        "no_llm_in_scoring_loop": True,
        "model_inference_type": "embedding-only (encode, no generation)",
    }
