import math
import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional

import numpy as np

from .embedding_utils import cosine_similarity, embed_texts, get_candidate_embeddings, load_model
from .signal_scorer import clamp, safe_float, score_availability, score_signal_modifier


WEIGHTS = {
    "skill_match": 0.35,
    "career_fit": 0.25,
    "signal_modifier": 0.15,
    "education": 0.15,
    "availability": 0.10,
}

MAX_CAREER_SCORE = 3.0

EDUCATION_TIER_WEIGHT = {
    "tier_1": 1.0,
    "tier_2": 0.75,
    "tier_3": 0.5,
    "tier_4": 0.3,
    "unknown": 0.2,
}


def tokenize(text: Any) -> set:
    return set(re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]*", str(text or "").lower()))


def text_match(value: Any, target: Any) -> float:
    source = tokenize(value)
    wanted = tokenize(target)
    if not source or not wanted:
        return 0.0
    return clamp(len(source & wanted) / len(wanted))


def years_ago(value: Any) -> float:
    if not value:
        return 10.0
    try:
        parsed = datetime.fromisoformat(str(value)).date()
    except ValueError:
        return 10.0
    today = date.today()
    months = max(0, (today.year - parsed.year) * 12 + today.month - parsed.month)
    return months / 12.0


def score_skill_match(
    candidate_id: str,
    jd_embedding: np.ndarray,
    candidate_embeddings: Dict[str, np.ndarray],
    candidate: Dict[str, Any] = None,
) -> float:
    base = clamp((cosine_similarity(jd_embedding, candidate_embeddings.get(candidate_id)) + 1.0) / 2.0)

    # Endorsement multiplier: rewards peer-validated competence
    skills = (candidate or {}).get("skills") or []
    if skills:
        boosts = [
            min(1.0, 0.5 + (skill.get("endorsements", 0) / 20.0))
            for skill in skills
        ]
        endorsement_boost = sum(boosts) / len(boosts)
    else:
        endorsement_boost = 0.5

    return clamp(base * endorsement_boost * 2.0)


def score_career_fit(candidate: Dict[str, Any], jd: Dict[str, Any]) -> float:
    target_title = jd.get("target_title") or ""
    target_industry = jd.get("target_industry") or ""
    min_experience = safe_float(jd.get("min_experience_years"), 0.0)
    profile = candidate.get("profile") or {}

    raw_score = 0.0
    for role in candidate.get("career_history") or []:
        decay = math.exp(-0.3 * years_ago(role.get("start_date")))
        title_score = text_match(role.get("title"), target_title)
        industry_score = 1.0 if str(target_industry).lower() == "any" else text_match(role.get("industry"), target_industry)
        raw_score += decay * (0.6 * title_score + 0.4 * industry_score)

    if min_experience > 0:
        experience_score = clamp(safe_float(profile.get("years_of_experience")) / min_experience)
        raw_score += experience_score * 0.5

    return clamp(raw_score / MAX_CAREER_SCORE)


def score_education(candidate: Dict[str, Any], jd: Dict[str, Any]) -> float:
    education = candidate.get("education") or []
    target_field = jd.get("target_field") or "Computer Science"
    if not education:
        return 0.0

    best = 0.0
    DEGREE_WEIGHT = {"phd": 1.0, "master": 0.9, "bachelor": 0.75, "diploma": 0.5}
    for item in education:
        tier = EDUCATION_TIER_WEIGHT.get(str(item.get("tier") or "unknown").lower(), 0.2)
        field_match = 1.0 if text_match(item.get("field_of_study"), target_field) > 0 else 0.4
        degree = str(item.get("degree") or "").lower()
        degree_mult = next((v for k, v in DEGREE_WEIGHT.items() if k in degree), 0.6)
        best = max(best, tier * field_match * degree_mult)

    return clamp(best)


def build_reasoning(candidate: Dict[str, Any], breakdown: Dict[str, float], jd: Dict[str, Any]) -> str:
    profile = candidate.get("profile") or {}
    signals = candidate.get("redrob_signals") or {}
    title = profile.get("current_title") or profile.get("headline") or "Candidate"
    years = safe_float(profile.get("years_of_experience"))
    skills = candidate.get("skills") or []
    jd_required = set(s.lower() for s in jd.get("raw_required_skills", jd.get("required_skills", [])))
    matched_skills = sum(1 for s in skills if s.get("name","").lower() in jd_required)
    response_rate = safe_float(signals.get("recruiter_response_rate"))
    top_component = max(breakdown, key=breakdown.get).replace("_", " ")

    return (
        f"{title} with {years:.1f} yrs; "
        f"{matched_skills} AI core skills matched; "
        f"top signal {top_component}; "
        f"response rate {response_rate:.2f}."
    )


def score_candidate(
    candidate: Dict[str, Any],
    jd: Dict[str, Any],
    jd_embedding: np.ndarray,
    candidate_embeddings: Dict[str, np.ndarray],
) -> Dict[str, Any]:
    candidate_id = str(candidate.get("candidate_id") or candidate.get("id") or "")
    signals = candidate.get("redrob_signals") or {}

    breakdown = {
        "skill_match": score_skill_match(candidate_id, jd_embedding, candidate_embeddings, candidate),
        "career_fit": score_career_fit(candidate, jd),
        "signal_modifier": score_signal_modifier(signals),
        "education": score_education(candidate, jd),
        "availability": score_availability(signals),
    }

    final_score = sum(breakdown[key] * WEIGHTS[key] for key in WEIGHTS)
    rounded_breakdown = {key: round(value, 4) for key, value in breakdown.items()}

    return {
        "candidate_id": candidate_id,
        "score": round(clamp(final_score), 4),
        "score_breakdown": rounded_breakdown,
        "breakdown": {
            "skill": rounded_breakdown["skill_match"],
            "semantic": rounded_breakdown["career_fit"],
            "activity": rounded_breakdown["signal_modifier"],
            **rounded_breakdown,
        },
        "reasoning": build_reasoning(candidate, rounded_breakdown, jd),
    }


def rank_candidates(
    candidates: List[Dict[str, Any]],
    jd: Dict[str, Any],
    model=None,
    cache_path: str = ".embedding_cache.pkl",
    limit: Optional[int] = 100,
) -> List[Dict[str, Any]]:
    valid_candidates = [candidate for candidate in candidates if isinstance(candidate, dict)]
    if not valid_candidates:
        return []

    model = model or load_model()
    jd_embedding = embed_texts(model, [str(jd.get("skills_text") or "")])[0]
    candidate_embeddings = get_candidate_embeddings(valid_candidates, model, cache_path=cache_path)

    scored = [
        score_candidate(candidate, jd, jd_embedding, candidate_embeddings)
        for candidate in valid_candidates
    ]
    scored.sort(key=lambda row: (-row["score"], row["candidate_id"]))

    if limit is not None:
        scored = scored[:limit]

    for index, row in enumerate(scored, start=1):
        row["rank"] = index

    return scored
