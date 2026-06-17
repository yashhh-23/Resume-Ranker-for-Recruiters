import os
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ranker import parse_jd_text, rank_candidates
from ranker.candidate_scorer import WEIGHTS


app = FastAPI(title="RRR Resume Ranker Backend")

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
    allow_headers=["*"],
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
    return {"status": "ok"}


@app.post("/rank")
async def rank(req: RankRequest):
    if not req.job_description.strip():
        raise HTTPException(status_code=400, detail="job_description is required")
    if not req.candidates:
        raise HTTPException(status_code=400, detail="candidates array is required")

    jd = parse_jd_text(req.job_description)
    ranked = rank_candidates(req.candidates, jd, limit=100)

    return {
        "ranked_candidates": ranked,
        "results": ranked,
        "total_candidates": len(req.candidates),
        "ranked_count": len(ranked),
        "scoring_model": {
            "name": "semantic_weighted_v1",
            "weights": WEIGHTS,
        },
    }
