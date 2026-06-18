import math
import re
import sys
from datetime import date, datetime
from typing import Any, Dict, List, Optional

import numpy as np

from .embedding_utils import (
    cosine_similarity,
    embed_texts,
    get_candidate_embeddings,
    get_jd_embedding,
    load_model,
)
from .signal_scorer import clamp, safe_float, score_availability, score_signal_modifier
from .validators import validate_candidate

WEIGHTS = {
    "skill_match": 0.35,
    "career_fit": 0.25,
    "signal_modifier": 0.15,
    "education": 0.15,
    "availability": 0.10,
}

MAX_CAREER_SCORE = 5.0

EDUCATION_TIER_WEIGHT = {
    "tier_1": 1.0,
    "tier_2": 0.75,
    "tier_3": 0.5,
    "tier_4": 0.3,
    "unknown": 0.2,
}


COMPOUND_SKILLS = [
    "machine learning",
    "deep learning",
    "natural language processing",
    "apache kafka",
    "apache spark",
    "power bi",
    "google cloud",
]


import functools

@functools.lru_cache(maxsize=4096)
def tokenize(text: Any) -> frozenset:
    text_str = str(text or "").lower()
    tokens = set()
    for compound in COMPOUND_SKILLS:
        if compound in text_str:
            tokens.add(compound)
            text_str = text_str.replace(compound, "")
    tokens.update(re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]*", text_str))
    return frozenset(tokens)

def _get_candidate_skill_names(skills: List[Dict[str, Any]]) -> set[str]:
    return {str(s.get("name", "")).lower() for s in skills if s.get("name")}


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


PROFICIENCY_WEIGHTS = {
    "expert": 1.0,
    "advanced": 0.85,
    "intermediate": 0.65,
    "beginner": 0.35,
}


def apply_pass_1_bouncer(candidate: Dict[str, Any]) -> tuple[bool, bool]:
    fraudulent_timeline = False
    blacklist_penalty = False

    profile = candidate.get("profile") or {}
    years_exp = safe_float(profile.get("years_of_experience", 0.0))
    career_history = candidate.get("career_history") or []
    
    total_duration_months = 0.0
    for role in career_history:
        dur = role.get("duration_months")
        if dur is not None:
            total_duration_months += safe_float(dur, 0.0)
        else:
            start = role.get("start_date")
            end = role.get("end_date")
            if start:
                try:
                    s_date = datetime.fromisoformat(str(start)).date()
                    e_date = datetime.fromisoformat(str(end)).date() if end else date.today()
                    total_duration_months += max(0, (e_date.year - s_date.year) * 12 + e_date.month - s_date.month)
                except ValueError:
                    pass
    
    if years_exp * 12 > total_duration_months and total_duration_months > 0:
        fraudulent_timeline = True

    current_title = str(profile.get("current_title") or "").lower()
    blacklist = ["civil", "mechanical", "hr", "marketing", "accountant", "analyst", "manager"]
    if any(b in current_title for b in blacklist):
        blacklist_penalty = True

    for skill in candidate.get("skills") or []:
        dur = safe_float(skill.get("duration_months"), 0.0)
        prof = str(skill.get("proficiency") or "").lower()
        if dur == 0.0 and prof in ("expert", "advanced"):
            skill["proficiency"] = "beginner"

    return fraudulent_timeline, blacklist_penalty

def _get_skill_cross_field_multiplier(skill_name: str, career_history: list) -> float:
    if not skill_name:
        return 0.3
    skill_lower = skill_name.lower()
    for role in career_history:
        desc = str(role.get("description") or "").lower()
        if skill_lower in desc:
            return 1.0
    return 0.3

def score_required_skill_coverage(candidate: dict, jd: dict) -> float:
    required = [s.lower() for s in jd.get("required_skills", [])]
    if not required:
        return 1.0  # no hard requirements = full score

    career_history = candidate.get("career_history") or []
    matched_score = 0.0
    for r in required:
        best_level = 0.0
        for s in candidate.get("skills") or []:
            cs = s.get("name", "").lower()
            if r in cs or cs in r:
                level = str(s.get("proficiency") or "intermediate").lower().strip()
                base_level_weight = PROFICIENCY_WEIGHTS.get(level, 0.65)
                multiplier = _get_skill_cross_field_multiplier(cs, career_history)
                best_level = max(best_level, base_level_weight * multiplier)
        matched_score += best_level

    base_coverage = matched_score / len(required)

    preferred = [s.lower() for s in jd.get("preferred_skills", [])]
    if preferred:
        candidate_skills_lower = _get_candidate_skill_names(candidate.get("skills") or [])
        pref_matched = sum(
            1 for p in preferred if any(p in cs for cs in candidate_skills_lower)
        )
        preferred_bonus = clamp(pref_matched / len(preferred)) * 0.15  # max 15% bonus
        return clamp(base_coverage + preferred_bonus)
    return clamp(base_coverage)


def score_skill_match(
    candidate_id: str,
    jd_embedding: np.ndarray,
    candidate_embeddings: Dict[str, np.ndarray],
    candidate: Dict[str, Any] = None,
    jd: Dict[str, Any] = None,
) -> float:
    raw_cos = cosine_similarity(jd_embedding, candidate_embeddings.get(candidate_id)) or 0.0
    base = clamp(raw_cos)

    # Endorsement multiplier: rewards peer-validated competence
    skills = (candidate or {}).get("skills") or []
    if skills:
        boosts = [
            min(1.0, 0.5 + (skill.get("endorsements", 0) / 20.0)) for skill in skills
        ]
        endorsement_boost = sum(boosts) / len(boosts)
    else:
        endorsement_boost = 0.5

    coverage_score = score_required_skill_coverage(candidate or {}, jd or {})
    blended_skill = 0.65 * base + 0.20 * coverage_score + 0.15 * endorsement_boost
    return clamp(blended_skill)


def recency_weight(duration_months_ago: float, seniority: str = "mid") -> float:
    half_life = {"junior": 18, "mid": 36, "senior": 60, "lead": 72}.get(seniority, 36)
    return math.exp(-0.693 * duration_months_ago / half_life)


def _seniority_score(candidate_years: float, jd_seniority: str) -> float:
    """Returns 0.0-1.0 based on how well candidate experience aligns with JD seniority."""
    bands = {
        "junior": (0, 2),
        "mid": (2, 5),
        "senior": (5, 10),
        "lead": (8, 99),
    }
    low, high = bands.get(jd_seniority, (0, 99))
    if candidate_years < low:
        # Under-qualified: linear decay from low boundary
        return clamp(candidate_years / max(low, 1))
    elif candidate_years > high + 5:
        # Massively over-qualified (e.g., 20yr for junior role): slight penalty
        return 0.7
    return 1.0


def score_career_fit(candidate: Dict[str, Any], jd: Dict[str, Any]) -> float:
    target_title = jd.get("target_title") or ""
    target_industry = jd.get("target_industry") or ""
    min_experience = safe_float(jd.get("min_experience_years"), 0.0)
    profile = candidate.get("profile") or {}
    seniority = jd.get("seniority_level", "mid")
    years_exp = safe_float(profile.get("years_of_experience"))
    seniority_align = _seniority_score(years_exp, seniority)

    raw_score = 0.0
    career_history = candidate.get("career_history") or []
    penalty_companies = {"tcs", "infosys", "wipro", "cognizant", "capgemini"}
    it_penalty = 0.0
    for role in career_history:
        comp = str(role.get("company") or "").lower()
        if any(p in comp for p in penalty_companies):
            it_penalty = 0.2
            
        months_ago = years_ago(role.get("start_date")) * 12
        decay = recency_weight(months_ago, seniority)
        title_score = text_match(role.get("title"), target_title)
        industry_score = (
            1.0
            if str(target_industry).lower() == "any"
            else text_match(role.get("industry"), target_industry)
        )
        raw_score += decay * (0.6 * title_score + 0.4 * industry_score)

    role_score = raw_score / max(1, len(career_history))

    exp_score = 0.0
    if min_experience > 0:
        exp_score = clamp(years_exp / min_experience)

    gated_exp_score = exp_score if role_score > 0.2 else exp_score * 0.3
    return clamp(role_score * 0.6 + gated_exp_score * 0.25 + seniority_align * 0.15 - it_penalty)


def score_education(candidate: Dict[str, Any], jd: Dict[str, Any]) -> float:
    education_list = candidate.get("education") or []
    education_list = [e for e in education_list if e and isinstance(e, dict) and e.get("degree")]
    if not education_list:
        profile = candidate.get("profile") or {}
        try:
            years_exp = float(profile.get("years_of_experience") or 0.0)
        except (ValueError, TypeError):
            years_exp = 0.0
        return clamp(years_exp / 20.0) * 0.5

    target_field = jd.get("target_field") or "Computer Science"

    best = 0.0
    DEGREE_WEIGHT = {"phd": 1.0, "master": 0.9, "bachelor": 0.75, "diploma": 0.5}
    for item in education_list:
        tier = EDUCATION_TIER_WEIGHT.get(
            str(item.get("tier") or "unknown").lower(), 0.2
        )
        field_match = (
            1.0 if text_match(item.get("field_of_study"), target_field) > 0 else 0.4
        )
        degree = str(item.get("degree") or "").lower()
        degree_mult = next((v for k, v in DEGREE_WEIGHT.items() if k in degree), 0.6)
        best = max(best, tier * field_match * degree_mult)

    return clamp(best)


def build_reasoning(
    candidate: Dict[str, Any], breakdown: Dict[str, float], jd: Dict[str, Any]
) -> str:
    profile = candidate.get("profile") or {}
    signals = candidate.get("redrob_signals") or {}
    title = profile.get("current_title") or profile.get("headline") or "Candidate"
    years = safe_float(profile.get("years_of_experience"))
    skills = candidate.get("skills") or []
    jd_skills_lower = {s.lower() for s in jd.get("required_skills", [])}
    matched_display = [
        s["name"] for s in skills
        if s.get("name", "").lower() in jd_skills_lower
    ]
    display_names = matched_display[:5]
    overflow = len(matched_display) - len(display_names)
    overflow_str = f" (+{overflow} more)" if overflow > 0 else ""
    matched_skills_str = (
        f"{len(matched_display)} required skill(s) matched: {', '.join(display_names)}{overflow_str}"
        if matched_display
        else "no required skills matched"
    )
    
    response_rate = safe_float(signals.get("recruiter_response_rate"))
    top_component = max(breakdown, key=breakdown.get).replace("_", " ")

    return (
        f"{title} with {years:.1f} yrs; "
        f"{matched_skills_str}; "
        f"top signal {top_component}; "
        f"response rate {response_rate:.2f}."
    )


def score_candidate(
    candidate: Dict[str, Any],
    jd: Dict[str, Any],
    jd_embedding: np.ndarray,
    candidate_embeddings: Dict[str, np.ndarray],
) -> Dict[str, Any]:
    fraud_timeline, blacklist_penalty = apply_pass_1_bouncer(candidate)

    candidate_id = str(candidate.get("candidate_id") or candidate.get("id") or "")
    signals = candidate.get("redrob_signals") or {}

    breakdown = {
        "skill_match": score_skill_match(
            candidate_id, jd_embedding, candidate_embeddings, candidate, jd
        ),
        "career_fit": score_career_fit(candidate, jd),
        "signal_modifier": score_signal_modifier(signals, jd),
        "education": score_education(candidate, jd),
        "availability": score_availability(signals),
    }

    final_score = sum(breakdown[key] * WEIGHTS[key] for key in WEIGHTS)
    if blacklist_penalty:
        final_score *= 0.2
    if fraud_timeline:
        final_score = 0.0
    rounded_breakdown = {key: round(value, 4) for key, value in breakdown.items()}

    profile = candidate.get("profile") or {}
    years = safe_float(profile.get("years_of_experience"))
    skills = candidate.get("skills") or []

    jd_required_list = jd.get("raw_required_skills", jd.get("required_skills", []))
    candidate_skill_names = _get_candidate_skill_names(skills)
    matched = [r for r in jd_required_list if r.lower() in candidate_skill_names]
    missing = [r for r in jd_required_list if r.lower() not in candidate_skill_names]

    seen = set()
    missing_dedup = [
        x for x in missing if not (x.lower() in seen or seen.add(x.lower()))
    ]
    missing_preview = ", ".join(missing_dedup[:3]) + (
        "..." if len(missing_dedup) > 3 else ""
    )

    preferred_jd = jd.get("preferred_skills", [])
    preferred_matched = [p for p in preferred_jd if p.lower() in candidate_skill_names]

    skill_match_desc = (
        f"{len(matched)}/{len(jd_required_list)} required skills matched"
        + (
            f"; missing: {missing_preview}"
            if missing_dedup
            else "; all required skills present"
        )
        + (
            f"; {len(preferred_matched)}/{len(preferred_jd)} preferred skills matched"
            if preferred_jd
            else ""
        )
    )

    career_history = candidate.get("career_history") or []
    min_exp = safe_float(jd.get("min_experience_years"), 0.0)
    response_rate = safe_float(signals.get("recruiter_response_rate"))
    github_score = safe_float(signals.get("github_activity_score"), 0.0)
    notice_days = safe_float(signals.get("notice_period_days"), 180.0)
    open_flag = signals.get("open_to_work_flag", False)
    reloc = signals.get("willing_to_relocate", False)

    flags, deduped_skills = validate_candidate(candidate)
    if deduped_skills is not None:
        candidate["skills"] = deduped_skills

    education_list = candidate.get("education") or []
    best_degree = "No degree listed"
    best_tier = "unknown"
    best_field = "unknown"
    if education_list:
        best_edu = max(
            education_list,
            key=lambda e: next(
                (
                    v
                    for k, v in {
                        "phd": 4,
                        "master": 3,
                        "bachelor": 2,
                        "diploma": 1,
                    }.items()
                    if k in str(e.get("degree", "")).lower()
                ),
                0,
            ),
            default={},
        )
        best_degree = best_edu.get("degree", "No degree listed")
        best_tier = best_edu.get("tier", "unknown")
        best_field = best_edu.get("field_of_study", "unknown")

    education_desc = (
        f"Best: {best_degree} ({best_field}), {best_tier} tier; {years:.1f}y exp"
    )

    reasoning_str = build_reasoning(candidate, rounded_breakdown, jd)
    if flags:
        flag_summary = "; ".join(flags[:2]) + ("..." if len(flags) > 2 else "")
        try:
            encoding = sys.stdout.encoding if sys.stdout else None
        except Exception:
            encoding = None
        WARNING_CHAR = "⚠" if encoding and "utf" in encoding.lower() else "[!]"
        reasoning_str += f" | {WARNING_CHAR} Flags: {flag_summary}"

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
        "reasoning": reasoning_str,
        "signal_reasoning": {
            "skill_match": skill_match_desc,
            "career_fit": f"{len(career_history)} roles; {years:.1f}y exp vs {min_exp}y min; role relevance: {rounded_breakdown['career_fit']:.2f}",
            "signal_modifier": f"Response rate: {response_rate:.2f}; GitHub: {github_score:.0f}/100",
            "education": education_desc,
            "availability": f"Notice: {notice_days}d; Open: {open_flag}; Relocate: {reloc}",
        },
        "compliance_flags": flags,
        "is_suspicious": len(flags) > 0,
        "profile_completeness": round(
            safe_float(signals.get("profile_completeness_score", 0.0))
        ),
    }


def rank_candidates(
    candidates: List[Dict[str, Any]],
    jd: Dict[str, Any],
    model=None,

    limit: Optional[int] = 100,
) -> List[Dict[str, Any]]:
    valid_candidates = [
        candidate for candidate in candidates if isinstance(candidate, dict)
    ]
    if not valid_candidates:
        return []

    model = model or load_model()
    jd_embedding = get_jd_embedding(jd, model)
    candidate_embeddings = get_candidate_embeddings(
        valid_candidates, model
    )

    scored = [
        score_candidate(candidate, jd, jd_embedding, candidate_embeddings)
        for candidate in valid_candidates
    ]
    scored.sort(key=lambda x: (-x["score"], str(x.get("candidate_id", ""))))

    if limit is not None:
        scored = scored[:limit]

    for index, row in enumerate(scored, start=1):
        row["rank"] = index

    return scored
