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
from .jd_parser import TECH_SKILLS

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

# Config-driven mapping: core education domains keyed by JD target_field.
# When target_field is "General" or not in the map, core_domains is empty → no off-domain penalty.
FIELD_CORE_DOMAINS = {
    "computer science": ["computer", "data", "machine", "artificial", "software", "information", "it", "cs", "ai", "math", "statistic"],
    "data science": ["data", "statistics", "math", "computer", "ai", "machine", "quantitative"],
    "information technology": ["computer", "information", "it", "software", "data", "network", "system"],
    "engineering": ["engineer", "computer", "electrical", "mechanical", "software", "system"],
    "statistics": ["statistics", "math", "data", "quantitative", "actuarial", "economics"],
    "mathematics": ["math", "statistics", "quantitative", "computational", "applied"],
    "marketing": ["marketing", "business", "communication", "media", "advertising", "brand"],
    "business": ["business", "management", "commerce", "economics", "marketing", "finance"],
    "design": ["design", "art", "media", "communication", "architecture", "creative"],
    "general": [],
}

# Tech/ML fields used to gate domain-specific penalty logic
TECH_FIELDS = {"computer science", "data science", "information technology", "engineering", "statistics", "mathematics"}


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
    text_str = re.sub(r"\b(ml|machine learning|artificial intelligence)\b", "ai", text_str)
    tokens = set()
    for compound in COMPOUND_SKILLS:
        if compound in text_str:
            tokens.add(compound)
            text_str = text_str.replace(compound, "")
    tokens.update(re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]*", text_str))
    return frozenset(tokens)

def _get_candidate_skill_names(skills: List[Dict[str, Any]]) -> set[str]:
    return {str(s.get("name", "")).lower() for s in skills if s.get("name")}

SKILL_ALIASES = {
    "llms": {"llms", "llm", "large language model", "large language models", "gpt", "gpt-3", "gpt-4", "transformer", "transformers", "bert", "openai", "claude", "gemini", "llama", "hugging face", "huggingface"},
    "llm": {"llms", "llm", "large language model", "large language models", "gpt", "gpt-3", "gpt-4", "transformer", "transformers", "bert", "openai", "claude", "gemini", "llama", "hugging face", "huggingface"},
    "large language models": {"llms", "llm", "large language model", "large language models", "gpt", "gpt-3", "gpt-4", "transformer", "transformers", "bert", "openai", "claude", "gemini", "llama", "hugging face", "huggingface"},
    "large language model": {"llms", "llm", "large language model", "large language models", "gpt", "gpt-3", "gpt-4", "transformer", "transformers", "bert", "openai", "claude", "gemini", "llama", "hugging face", "huggingface"},
    "retrieval": {"retrieval", "rag", "vector search", "embedding search", "retrieval augmented generation", "faiss", "pinecone", "qdrant", "milvus", "weaviate", "elasticsearch", "opensearch", "bm25", "hybrid retrieval"},
    "hybrid retrieval": {"retrieval", "rag", "vector search", "embedding search", "retrieval augmented generation", "faiss", "pinecone", "qdrant", "milvus", "weaviate", "elasticsearch", "opensearch", "bm25", "hybrid retrieval"},
    "fine-tuning": {"fine-tuning", "finetuning", "fine tuning", "peft", "lora", "qlora", "rlhf", "sft", "instruction tuning"},
    "fine-tuning llms": {"fine-tuning", "finetuning", "fine tuning", "peft", "lora", "qlora", "rlhf", "sft", "instruction tuning", "fine-tuning llms"},
}

import time

_time_bouncer = 0.0
_time_career_fit = 0.0

@functools.lru_cache(maxsize=16384)
def is_skill_match(r: str, c: str) -> bool:
    r_clean = r.lower().strip()
    c_clean = c.lower().strip()
    if r_clean in c_clean or c_clean in r_clean:
        return True
    r_aliases = SKILL_ALIASES.get(r_clean, {r_clean})
    c_aliases = SKILL_ALIASES.get(c_clean, {c_clean})
    if r_aliases & c_aliases:
        return True
    for alias in r_aliases:
        if alias in c_clean or c_clean in alias:
            return True
    return False

def calibrate_score(score: float) -> float:
    s = max(0.0, min(1.0, score))
    return (math.exp(1.2 * s) - 1.0) / (math.exp(1.2) - 1.0)


def text_match(value: Any, target: Any, target_tokens: Optional[frozenset] = None) -> float:
    source = tokenize(value)
    wanted = target_tokens if target_tokens is not None else tokenize(target)
    if not source or not wanted:
        return 0.0
    return clamp(len(source & wanted) / len(wanted))

def preprocess_jd(jd: Dict[str, Any]) -> None:
    if "_preprocessed" in jd:
        return
    
    target_title = (jd.get("target_title") or "").lower()
    target_field = (jd.get("target_field") or "Computer Science").lower()
    
    jd["_cached_target_title"] = target_title
    jd["_cached_target_title_tokens"] = tokenize(target_title)
    jd["_cached_target_field"] = target_field
    jd["_cached_target_field_tokens"] = tokenize(target_field)
    jd["_cached_is_tech_field"] = target_field in TECH_FIELDS
    jd["_cached_core_domains"] = FIELD_CORE_DOMAINS.get(target_field, [])
    jd["_cached_min_experience"] = safe_float(jd.get("min_experience_years"), 0.0)
    jd["_cached_seniority"] = jd.get("seniority_level", "mid")
    jd["_cached_target_industry"] = jd.get("target_industry") or ""
    jd["_preprocessed"] = True


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


# ---------------------------------------------------------------------------
# FIX 1 — Gaussian Experience Bell Curve (replaces hard quadratic cliff)
# Smoothly grades experience fit centered on the target range.
# Asymmetric: under-experience penalised harder than over-experience.
# CPU-only, deterministic, zero-LLM.
# ---------------------------------------------------------------------------
def _gaussian_exp_fit(actual: float, target_min: float, target_max: Optional[float] = None) -> float:
    """Returns 0.01–1.0 experience fit score using a Gaussian bell curve.
    
    Centered on (target_min + target_max) / 2 with asymmetric penalty
    for candidates below target_min.
    """
    target_max = target_max or (target_min + 3.0)
    optimal = (target_min + target_max) / 2.0
    spread = (target_max - target_min) if target_max != target_min else 2.0
    sigma = spread / 1.5
    score = math.exp(-((actual - optimal) ** 2) / (2 * (sigma ** 2)))
    if actual < target_min:
        # Extra asymmetric penalty for under-experience
        score *= (actual / max(target_min, 0.1)) ** 2
    return max(0.01, min(1.0, score))


# ---------------------------------------------------------------------------
# FIX 2 — Non-Tech Title Cluster Guard (taxonomy layer)
# Catches field-mismatched titles that slip through text_match() token
# overlap (e.g. "Mechanical Engineer" for an ML JD shares "engineer").
# Only fires for tech JDs. Deterministic keyword set — no LLM.
# ---------------------------------------------------------------------------
NON_TECH_TITLE_CLUSTERS = {
    "mechanical", "civil", "structural", "chemical", "hr", "human resource",
    "marketing", "sales", "finance", "legal", "accountant", "nurse",
    "doctor", "teacher", "designer", "architect",
}
TECH_TITLE_KEYWORDS = {
    "software", "data", "ml", "ai", "engineer", "developer", "analyst",
    "scientist", "backend", "frontend", "fullstack", "devops", "platform",
    "machine", "deep", "nlp", "research",
}


TECH_SKILLS_SET = {s.lower() for s in TECH_SKILLS}

def is_tech_domain(jd: Dict[str, Any]) -> bool:
    target_title = str(jd.get("target_title") or "").lower()
    target_field = str(jd.get("target_field") or "").lower()
    required_skills = [s.lower() for s in jd.get("required_skills", [])]
    
    tech_keywords = {
        "software", "developer", "engineer", "scientist", "data", "ml", "ai", 
        "backend", "frontend", "fullstack", "architect", "programmer", "sde"
    }
    
    if any(k in target_title for k in tech_keywords):
        return True
    if any(f in target_field for f in ["computer science", "data science", "information technology", "engineering"]):
        return True
    if any(s in TECH_SKILLS_SET for s in required_skills):
        return True
        
    return False

def check_title_blacklist_penalty(candidate: Dict[str, Any], jd: Dict[str, Any]) -> bool:
    profile = candidate.get("profile") or {}
    current_title = str(profile.get("current_title") or profile.get("headline") or "").lower()
    if not current_title:
        career_history = candidate.get("career_history") or []
        if career_history:
            current_title = str(career_history[0].get("title") or "").lower()
            
    if not current_title:
        return False
        
    is_tech = is_tech_domain(jd)
    if is_tech:
        blacklist = ["civil", "mechanical", "electrical", "hr", "graphic", "marketing", "accountant"]
        if any(token in current_title for token in blacklist):
            return True
            
    return False


def apply_pass_1_bouncer(candidate: Dict[str, Any], jd: Optional[Dict[str, Any]] = None) -> tuple[bool, bool]:
    """Pass-1 bouncer: fraud detection + JD-derived title mismatch penalty.
    
    Instead of a hardcoded blacklist, compares candidate title against JD
    target_title using text_match() for domain-agnostic filtering.
    Also applies a taxonomy cluster guard (Fix 2) for tech JDs.
    """
    fraudulent_timeline = False
    blacklist_penalty = False
    jd = jd or {}

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
    
    # Allow a reasonable tolerance of 24 months for rounding and short gaps
    if years_exp * 12 > total_duration_months + 24 and total_duration_months > 0:
        fraudulent_timeline = True

    # JD-derived title mismatch: compare candidate title against JD target_title
    current_title = str(profile.get("current_title") or profile.get("headline") or "").lower()
    if not current_title and career_history:
        current_title = str(career_history[0].get("title") or "").lower()

    target_title = jd.get("_cached_target_title", (jd.get("target_title") or "").lower())
    if target_title and target_title != "any" and current_title:
        target_tokens = jd.get("_cached_target_title_tokens")
        title_overlap = text_match(current_title, target_title, target_tokens=target_tokens)
        if title_overlap == 0.0:
            blacklist_penalty = True

    # FIX 2: Taxonomy cluster guard — catch non-tech titles that slip through
    # token overlap (e.g. "Mechanical Engineer" shares "engineer" with "ML Engineer")
    is_tech_jd = jd.get("_cached_is_tech_field", False)
    if is_tech_jd and current_title and not blacklist_penalty:
        if any(k in current_title for k in NON_TECH_TITLE_CLUSTERS):
            if not any(t in current_title for t in TECH_TITLE_KEYWORDS):
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
    required = jd.get("_cached_required_skills")
    if required is None:
        required_list = jd.get("raw_required_skills")
        if not required_list:
            required_list = jd.get("required_skills", [])
        required = [s.lower() for s in required_list]
        jd["_cached_required_skills"] = required

    preferred = jd.get("_cached_preferred_skills")
    if preferred is None:
        preferred = [s.lower() for s in jd.get("preferred_skills", [])]
        jd["_cached_preferred_skills"] = preferred

    # Remove duplicates from preferred if they are in required
    required_set = set(required)
    preferred = [p for p in preferred if p not in required_set]

    career_history = candidate.get("career_history") or []
    education_list = candidate.get("education") or []

    tier1_score = 0.0
    tier1_possible = 0.0
    matched_tier1_count = 0

    for r in required:
        best_level = 0.0
        best_cs = ""
        for s in candidate.get("skills") or []:
            cs = s.get("name", "").lower()
            if is_skill_match(r, cs):
                level = str(s.get("proficiency") or "intermediate").lower().strip()
                prof_bonus = {"expert": 0.05, "advanced": 0.03, "intermediate": 0.01, "beginner": 0.0}.get(level, 0.01)
                
                history_bonus = 0.0
                for role in career_history:
                    desc = str(role.get("description") or "").lower()
                    if cs in desc:
                        history_bonus = 0.05
                        break
                        
                candidate_level = 1.0 + prof_bonus + history_bonus
                if candidate_level > best_level:
                    best_level = candidate_level
                    best_cs = cs
        
        if best_level > 0.0 and best_cs:
            # Academic skill down-weight
            in_career = any(
                best_cs in str(role.get("description", "")).lower()
                for role in career_history
            )
            in_education = any(
                best_cs in (str(e.get("field_of_study", "")) + str(e.get("degree", ""))).lower()
                for e in education_list
            )
            if in_education and not in_career:
                best_level *= 0.4
                
        if best_level > 0.0:
            matched_tier1_count += 1
            
        tier1_score += best_level * 1.0
        tier1_possible += 1.10 * 1.0

    tier2_score = 0.0
    tier2_possible = 0.0
    for p in preferred:
        best_level = 0.0
        best_cs = ""
        for s in candidate.get("skills") or []:
            cs = s.get("name", "").lower()
            if is_skill_match(p, cs):
                level = str(s.get("proficiency") or "intermediate").lower().strip()
                prof_bonus = {"expert": 0.05, "advanced": 0.03, "intermediate": 0.01, "beginner": 0.0}.get(level, 0.01)
                
                history_bonus = 0.0
                for role in career_history:
                    desc = str(role.get("description") or "").lower()
                    if cs in desc:
                        history_bonus = 0.05
                        break
                        
                candidate_level = 1.0 + prof_bonus + history_bonus
                if candidate_level > best_level:
                    best_level = candidate_level
                    best_cs = cs
        
        if best_level > 0.0 and best_cs:
            # Academic skill down-weight
            in_career = any(
                best_cs in str(role.get("description", "")).lower()
                for role in career_history
            )
            in_education = any(
                best_cs in (str(e.get("field_of_study", "")) + str(e.get("degree", ""))).lower()
                for e in education_list
            )
            if in_education and not in_career:
                best_level *= 0.4
                
        tier2_score += best_level * 0.4
        tier2_possible += 1.10 * 0.4

    total_score = tier1_score + tier2_score
    total_possible = tier1_possible + tier2_possible

    if total_possible > 0:
        coverage = total_score / total_possible
    else:
        coverage = 0.5

    # Match count gate
    if len(required) > 0 and matched_tier1_count < 2:
        coverage *= 0.25

    # Blacklist penalty
    if check_title_blacklist_penalty(candidate, jd):
        coverage *= 0.10

    return clamp(coverage)


def score_skill_match(
    candidate_id: str,
    jd_similarity: float,
    candidate: Optional[Dict[str, Any]] = None,
    jd: Optional[Dict[str, Any]] = None,
) -> float:
    raw_cos = jd_similarity
    # Threshold semantic similarity to heavily penalize out-of-domain resumes (like Mobile Devs)
    base = clamp((raw_cos - 0.15) * 5.0)

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
    blended_skill = 0.15 * base + 0.75 * coverage_score + 0.10 * endorsement_boost

    # Apply same gates/penalties to the blended skill score
    required_skills = (jd or {}).get("required_skills", [])
    if required_skills:
        candidate_skills = {s.get("name", "").lower() for s in (candidate or {}).get("skills", []) if s.get("name")}
        matched_tier1 = sum(1 for r in required_skills if any(is_skill_match(r, cs) for cs in candidate_skills))
        if matched_tier1 < 2:
            blended_skill *= 0.25

    if check_title_blacklist_penalty(candidate or {}, jd or {}):
        blended_skill *= 0.10

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
    target_title = str(jd.get("_cached_target_title") or jd.get("target_title") or "")
    target_industry = str(jd.get("_cached_target_industry") or jd.get("target_industry") or "")
    min_experience = float(jd.get("_cached_min_experience") or safe_float(jd.get("min_experience_years"), 0.0))
    profile = candidate.get("profile") or {}
    seniority = str(jd.get("_cached_seniority") or jd.get("seniority_level") or "mid")
    years_exp = safe_float(profile.get("years_of_experience"))
    seniority_align = _seniority_score(years_exp, seniority)

    best_role_score = 0.0
    career_history = candidate.get("career_history") or []

    # IT consulting penalty: only apply for tech/engineering JDs
    it_penalty = 0.0
    is_tech_field = jd.get("_cached_is_tech_field", (jd.get("target_field") or "General").lower() in TECH_FIELDS)
    if is_tech_field:
        penalty_companies = {"tcs", "infosys", "wipro", "accenture", "cognizant", "capgemini"}
        it_consulting_count = sum(
            1 for role in career_history 
            if any(p in str(role.get("company") or "").lower() for p in penalty_companies)
        )
        it_penalty = 0.2 if (len(career_history) > 0 and it_consulting_count == len(career_history)) else 0.0

    target_tokens = jd.get("_cached_target_title_tokens")
    for role in career_history:
        months_ago = years_ago(role.get("start_date")) * 12
        decay = recency_weight(months_ago, seniority)
        title_score = text_match(role.get("title"), target_title, target_tokens=target_tokens)
        industry_score = (
            1.0
            if str(target_industry).lower() == "any"
            else text_match(role.get("industry"), target_industry)
        )
        role_val = decay * (0.6 * title_score + 0.4 * industry_score)
        best_role_score = max(best_role_score, role_val)

    role_score = max(0.2, best_role_score)

    # FIX 1: Gaussian bell curve replaces hard quadratic exp cliff.
    # Smoothly grades under/over-experience; asymmetric penalty for under-exp.
    exp_score = _gaussian_exp_fit(years_exp, min_experience) if min_experience > 0 else 1.0

    gated_exp_score = exp_score if role_score > 0.2 else exp_score * 0.3
    
    # Penalize career_fit for completely irrelevant roles
    if role_score < 0.08:
        role_score *= 0.1

    return clamp(role_score * 0.6 + gated_exp_score * 0.25 + seniority_align * 0.15)


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

    target_field = (jd.get("target_field") or "Computer Science").lower()
    # Config-driven: look up core domains from FIELD_CORE_DOMAINS mapping
    core_domains = jd.get("_cached_core_domains", FIELD_CORE_DOMAINS.get(target_field, []))
    target_field_tokens = jd.get("_cached_target_field_tokens")

    best = 0.0
    DEGREE_WEIGHT = {"phd": 1.0, "ph.d": 1.0, "master": 0.9, "bachelor": 0.75, "diploma": 0.5}
    for item in education_list:
        tier = EDUCATION_TIER_WEIGHT.get(
            str(item.get("tier") or "unknown").lower(), 0.2
        )
        field = str(item.get("field_of_study") or "").lower()
        if core_domains:
            field_match = (
                1.0 if text_match(field, target_field, target_tokens=target_field_tokens) > 0 or any(d in field for d in core_domains) else 0.4
            )
        else:
            # No core domains defined (e.g. "General") → no off-domain penalty
            field_match = 1.0 if text_match(field, target_field, target_tokens=target_field_tokens) > 0 else 0.7
        degree = str(item.get("degree") or "").lower()
        degree_mult = next((v for k, v in DEGREE_WEIGHT.items() if k in degree), 0.6)

        # Domain relevance penalty: only apply when core_domains are defined
        if core_domains and not any(d in field for d in core_domains):
            degree_mult = min(degree_mult, 0.4)  # 40% cap for completely irrelevant degrees

        best = max(best, tier * field_match * degree_mult)

    return clamp(best)


def build_reasoning(
    candidate: Dict[str, Any], breakdown: Dict[str, float], matched_skills: List[str], jd: Dict[str, Any]
) -> str:
    profile = candidate.get("profile") or {}
    signals = candidate.get("redrob_signals") or {}
    title = profile.get("current_title") or profile.get("headline") or "Candidate"
    years = safe_float(profile.get("years_of_experience"))
    
    display_names = matched_skills[:5]
    overflow = len(matched_skills) - len(display_names)
    overflow_str = f" (+{overflow} more)" if overflow > 0 else ""
    matched_skills_str = (
        f"{len(matched_skills)} required skill(s) matched: {', '.join(display_names)}{overflow_str}"
        if matched_skills
        else "no required skills matched"
    )
    
    response_rate = safe_float(signals.get("recruiter_response_rate"))
    top_component = max(breakdown, key=lambda k: breakdown[k]).replace("_", " ")

    return (
        f"{title} with {years:.1f} yrs; "
        f"{matched_skills_str}; "
        f"top signal {top_component}; "
        f"response rate {response_rate:.2f}."
    )


def score_jd_specific_traps(candidate: Dict[str, Any]) -> float:
    """Domain-gated trap penalties. Job-hopping is universal;
    CV/speech and LangChain traps only fire for tech/ML JDs."""
    penalty = 0.0

    # Job-hopping penalty: domain-agnostic, always apply
    career_history = candidate.get("career_history") or []
    if career_history:
        total_duration = 0.0
        for role in career_history:
            dur = role.get("duration_months")
            if dur is not None:
                total_duration += safe_float(dur, 0.0)
            else:
                start = role.get("start_date")
                end = role.get("end_date")
                if start:
                    try:
                        s_date = datetime.fromisoformat(str(start)).date()
                        e_date = datetime.fromisoformat(str(end)).date() if end else date.today()
                        total_duration += max(0, (e_date.year - s_date.year) * 12 + e_date.month - s_date.month)
                    except ValueError:
                        pass
        avg_duration = total_duration / len(career_history)
        if avg_duration < 18.0:
            penalty += 0.15

    skills = candidate.get("skills") or []
    skill_names = {str(s.get("name", "")).lower() for s in skills}
    
    has_cv_speech = any(x in n for n in skill_names for x in ["computer vision", "speech", "robotics"])
    has_nlp_ir = any(x in n for n in skill_names for x in ["nlp", "retrieval", "search", "ir "])
    if has_cv_speech and not has_nlp_ir:
        penalty += 0.20

    has_langchain = any("langchain" in n for n in skill_names)
    has_core_ml = any(x in n for n in skill_names for x in ["faiss", "pytorch", "tensorflow", "embeddings", "ranking"])
    if has_langchain and not has_core_ml:
        penalty += 0.15

    return penalty


def score_candidate(
    candidate: Dict[str, Any],
    jd: Dict[str, Any],
    jd_similarity: float,
) -> Dict[str, Any]:
    fraud_timeline, blacklist_penalty = apply_pass_1_bouncer(candidate, jd)

    candidate_id = str(candidate.get("candidate_id") or candidate.get("id") or "")
    signals = candidate.get("redrob_signals") or {}

    skills = candidate.get("skills") or []
    candidate_skill_names = _get_candidate_skill_names(skills)
    jd_req_val = jd.get("_cached_raw_req")
    if jd_req_val is None:
        raw_skills = jd.get("raw_required_skills") or jd.get("required_skills") or []
        jd_required_list = list(raw_skills)
        jd["_cached_raw_req"] = jd_required_list
        jd["_cached_req_zip"] = [(r, str(r).lower()) for r in jd_required_list]
    else:
        jd_required_list = list(jd_req_val)

    req_zip_val = jd.get("_cached_req_zip")
    req_zip = list(req_zip_val) if req_zip_val is not None else []
    matched = [r for r, rl in req_zip if any(is_skill_match(rl, cs) for cs in candidate_skill_names)]
    missing = [r for r, rl in req_zip if not any(is_skill_match(rl, cs) for cs in candidate_skill_names)]

    matched_count = len(matched)

    breakdown = {
        "skill_match": score_skill_match(
            candidate_id, jd_similarity, candidate, jd
        ),
        "career_fit": score_career_fit(candidate, jd),
        "signal_modifier": score_signal_modifier(signals, jd, matched_count=matched_count),
        "education": score_education(candidate, jd),
        "availability": score_availability(signals),
    }
    
    profile = candidate.get("profile") or {}
    years_exp = safe_float(profile.get("years_of_experience"), 0.0)

    # Dampen education contribution if career fit is weak
    if breakdown["career_fit"] < 0.30:
        if matched_count <= 1:
            breakdown["education"] *= 0.40
            if years_exp < 3.0:
                breakdown["education"] = min(breakdown["education"], 0.15)
            elif years_exp < 6.0:
                breakdown["education"] = min(breakdown["education"], 0.20)
            else:
                breakdown["education"] = min(breakdown["education"], 0.26)
        else:
            breakdown["education"] *= 0.70
            breakdown["education"] = min(breakdown["education"], 0.35)

    # Hard experience-gate: raw education cannot exceed these ceilings
    if years_exp < 2.0:
        breakdown["education"] = min(breakdown["education"], 0.15)
    elif years_exp < 5.0:
        breakdown["education"] = min(breakdown["education"], 0.30)

    min_experience = safe_float(jd.get("min_experience_years"), 0.0)
    exp_gap = max(0.0, min_experience - years_exp)
    if exp_gap > 0:
        exp_penalty = max(0.6, 1.0 - (exp_gap / min_experience) * 0.3)
        breakdown["career_fit"] *= exp_penalty

    # Notice period constraints / Availability decay multiplier
    notice_days = safe_float(signals.get("notice_period_days"), 180.0)
    if notice_days <= 30.0:
        availability_mult = 1.0
    elif notice_days <= 60.0:
        availability_mult = 0.80
    elif notice_days <= 90.0:
        availability_mult = 0.60
    else:
        availability_mult = 0.30

    # Multiplicative Telemetry score
    final_score = (breakdown["skill_match"] * breakdown["career_fit"]) * breakdown["signal_modifier"] * availability_mult

    if (jd.get("target_field") or "").lower() in ("computer science", "machine learning", "ai", "nlp"):
        trap_penalty = score_jd_specific_traps(candidate)
    else:
        trap_penalty = 0.0
        
    final_score = max(0.0, final_score - trap_penalty)

    if fraud_timeline:
        final_score = 0.0

    min_experience = safe_float(jd.get("min_experience_years"), 0.0)
    if min_experience > 0 and years_exp < min_experience:
        if years_exp < min_experience * 0.75:
            final_score *= 0.70
        else:
            final_score *= 0.85

    rounded_breakdown = {key: round(value, 4) for key, value in breakdown.items()}

    profile = candidate.get("profile") or {}
    years = safe_float(profile.get("years_of_experience"))

    seen = set()
    missing_dedup = [
        x for x in missing if not (x.lower() in seen or seen.add(x.lower()))
    ]
    missing_preview = ", ".join(missing_dedup[:3]) + (
        "..." if len(missing_dedup) > 3 else ""
    )

    preferred_jd_val = jd.get("_cached_raw_pref")
    if preferred_jd_val is None:
        preferred_jd_val = jd.get("preferred_skills") or []
        jd["_cached_raw_pref"] = preferred_jd_val
    preferred_jd = list(preferred_jd_val)
    preferred_jd_lower = [str(p).lower() for p in preferred_jd]
    preferred_matched = [p for p, pl in zip(preferred_jd, preferred_jd_lower) if any(is_skill_match(pl, cs) for cs in candidate_skill_names)]

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
    github_score = max(0.0, safe_float(signals.get("github_activity_score"), 0.0))
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

    # Use clean, candidate-centric reasoning from build_reasoning ONLY (no warning characters, tags, or debug gates)
    reasoning_str = build_reasoning(candidate, rounded_breakdown, matched, jd)

    if len(matched) == 0:
        flags.append("zero_skill_match")

    return {
        "candidate_id": candidate_id,
        "score": round(clamp(calibrate_score(final_score)), 4),
        "matched_count": len(matched),
        "score_breakdown": rounded_breakdown,
        "reasoning": reasoning_str,
        "signal_reasoning": {
            "skill_match": skill_match_desc,
            "career_fit": f"{len(career_history)} roles; {years:.1f}y exp vs {min_exp}y min; role relevance: {rounded_breakdown['career_fit']:.2f}" + (f"; Trap penalty: {trap_penalty:.2f}" if trap_penalty > 0 else ""),
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


def fast_score_candidate(candidate: Dict[str, Any], jd: Dict[str, Any]) -> float:
    global _time_bouncer, _time_career_fit
    
    t0 = time.perf_counter()
    fraud_timeline, blacklist_penalty = apply_pass_1_bouncer(candidate, jd)
    _time_bouncer += (time.perf_counter() - t0)
    
    signals = candidate.get("redrob_signals") or {}

    t0 = time.perf_counter()
    cf = score_career_fit(candidate, jd)
    _time_career_fit += (time.perf_counter() - t0)

    breakdown = {
        "skill_match": score_required_skill_coverage(candidate, jd),
        "career_fit": cf,
        "signal_modifier": score_signal_modifier(signals, jd),
        "education": score_education(candidate, jd),
        "availability": score_availability(signals),
    }

    # Notice period constraints / Availability decay multiplier
    notice_days = safe_float(signals.get("notice_period_days"), 180.0)
    if notice_days <= 30.0:
        availability_mult = 1.0
    elif notice_days <= 60.0:
        availability_mult = 0.80
    elif notice_days <= 90.0:
        availability_mult = 0.60
    else:
        availability_mult = 0.30

    final_score = (breakdown["skill_match"] * breakdown["career_fit"]) * breakdown["signal_modifier"] * availability_mult

    if (jd.get("target_field") or "").lower() in ("computer science", "machine learning", "ai", "nlp"):
        trap_penalty = score_jd_specific_traps(candidate)
    else:
        trap_penalty = 0.0
        
    final_score = max(0.0, final_score - trap_penalty)

    if fraud_timeline:
        final_score = 0.0

    return calibrate_score(final_score)


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

    global _time_bouncer, _time_career_fit
    _time_bouncer = 0.0
    _time_career_fit = 0.0
    
    preprocess_jd(jd)
    fast_scored = []
    for c in valid_candidates:
        fast_scored.append((fast_score_candidate(c, jd), c))
        
    print(f"Profile: bouncer={_time_bouncer:.2f}s, career_fit={_time_career_fit:.2f}s (inner hot-loop timers removed for performance)", file=sys.stderr)
    
    fast_scored.sort(key=lambda x: -x[0])
    
    top_candidates = [x[1] for x in fast_scored[:1000]]

    model = model or load_model()
    jd_embedding = get_jd_embedding(jd, model)
    candidate_embeddings = get_candidate_embeddings(
        top_candidates, model
    )

    candidate_ids = list(candidate_embeddings.keys())
    if candidate_ids:
        candidate_matrix = np.array([candidate_embeddings[cid] for cid in candidate_ids])
        jd_norm = np.linalg.norm(jd_embedding)
        jd_vec_norm = jd_embedding / (jd_norm + 1e-9)
        cand_norms = np.linalg.norm(candidate_matrix, axis=1, keepdims=True)
        similarities = (candidate_matrix @ jd_vec_norm) / (cand_norms.squeeze() + 1e-9)
        sim_map = dict(zip(candidate_ids, np.clip(similarities, -1.0, 1.0)))
    else:
        sim_map = {}

    scored = [
        score_candidate(candidate, jd, float(sim_map.get(str(candidate.get("candidate_id") or candidate.get("id") or ""), 0.0)))
        for candidate in top_candidates
    ]
    from functools import cmp_to_key

    def compare_candidates(a, b):
        if a["score"] != b["score"]:
            return -1 if a["score"] > b["score"] else 1
        if a["matched_count"] != b["matched_count"]:
            return b["matched_count"] - a["matched_count"]
        ida = str(a.get("candidate_id", ""))
        idb = str(b.get("candidate_id", ""))
        if ida == idb: return 0
        return -1 if ida < idb else 1

    scored.sort(key=cmp_to_key(compare_candidates))

    if limit is not None:
        scored = scored[:limit]

    for index, row in enumerate(scored, start=1):
        row["rank"] = index

    return scored
