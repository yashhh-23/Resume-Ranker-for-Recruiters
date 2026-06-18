import json
import logging

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List
from contextlib import asynccontextmanager

limiter = Limiter(key_func=get_remote_address)

from ranker import parse_jd_text, rank_candidates
from ranker.candidate_scorer import WEIGHTS
from ranker.signal_scorer import SIGNAL_WEIGHTS
from ranker.embedding_utils import load_model
from ranker.validators import sanitize_candidates

_START_TIME = time.time()
MAX_CANDIDATES = 1000
_MODEL_READY = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _MODEL_READY
    import asyncio
    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(None, load_model)
        _MODEL_READY = True
        print("[RRR] Model loaded and ready.")
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
            "path": str(request.url.path)
        }
    )

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded. Please try again later.",
            "status_code": 429,
            "path": str(request.url.path)
        }
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    logging.error(f"Unhandled error on {request.url.path}: {traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error. Please try again.",
            "status_code": 500,
            "request_id": getattr(request.state, "request_id", "unknown"),
        }
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
        "model": "sentence-transformers/all-MiniLM-L6-v2",
        "uptime_seconds": round(time.time() - _START_TIME),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


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
                   f"Use the standalone rank.py script for larger batches."
        )

    t0 = time.perf_counter()
    valid_candidates, skipped = sanitize_candidates(req.candidates)
    jd = parse_jd_text(req.job_description)
    ranked = rank_candidates(valid_candidates, jd, limit=100)
    elapsed_ms = round((time.perf_counter() - t0) * 1000)

    response = {
        "ranked_candidates": ranked,
        "skipped_candidates": {
            "count": len(skipped),
            "ids": skipped,
            "reason": "Failed data validation / sanitization"
        },
        "total_candidates": len(req.candidates),
        "valid_candidates": len(valid_candidates),
        "scored_candidates": len(valid_candidates),
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
            "name": "sentence_weighted_v1",
            "weights": WEIGHTS,
            "model_id": "sentence-transformers/all-MiniLM-L6-v2",
        },
    }
    if os.getenv("ENV", "development") != "production":
        response["jd_debug"] = jd

    return response

@app.post("/rank/upload")
@limiter.limit(RANK_RATE_LIMIT)
async def rank_upload(
    request: Request,
    job_description: str = Form(...),
    candidates_file: UploadFile = File(...)
):
    content = await candidates_file.read()
    lines = content.decode("utf-8").splitlines()
    candidates = []
    for line in lines:
        line = line.strip()
        if line:
            try:
                candidates.append(json.loads(line))
                if len(candidates) >= MAX_CANDIDATES:
                    break
            except json.JSONDecodeError:
                continue

    if not job_description.strip():
        raise HTTPException(status_code=400, detail="job_description is required")
    if not candidates:
        raise HTTPException(status_code=400, detail="candidates array is empty or invalid")

    t0 = time.perf_counter()
    valid_candidates, skipped = sanitize_candidates(candidates)
    jd = parse_jd_text(job_description)
    ranked = rank_candidates(valid_candidates, jd, limit=100)
    elapsed_ms = round((time.perf_counter() - t0) * 1000)

    response = {
        "ranked_candidates": ranked,
        "skipped_candidates": {
            "count": len(skipped),
            "ids": skipped,
            "reason": "Failed data validation / sanitization"
        },
        "total_candidates": len(candidates),
        "valid_candidates": len(valid_candidates),
        "scored_candidates": len(valid_candidates),
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
            "name": "sentence_weighted_v1",
            "weights": WEIGHTS,
            "model_id": "sentence-transformers/all-MiniLM-L6-v2",
        },
    }
    if os.getenv("ENV", "development") != "production":
        response["jd_debug"] = jd

    return response

@app.get("/info")
async def info():
    return {
        "project": "RRR — Resume Ranker for Recruiters",
        "team": "Team Chanakya",
        "hackathon": "Redrob H2S",
        "scoring_model": "sentence-transformers/all-MiniLM-L6-v2",
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
        "reasoning": "deterministic — no LLM generation",
    }
