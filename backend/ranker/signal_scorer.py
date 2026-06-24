import math
from typing import Any, Dict


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def mean(values):
    values = list(values)
    if not values:
        return 0.0
    return sum(values) / len(values)


def score_salary_fit(signals: dict, jd: dict) -> float:
    """Returns 1.0 if salary expectation is within JD range, else decays."""
    jd_min = safe_float(jd.get("salary_min"), 0)
    jd_max = safe_float(jd.get("salary_max"), 0)
    if jd_min == 0 and jd_max == 0:
        return 0.5  # JD doesn't specify salary → neutral
    
    c_min = safe_float(signals.get("salary_expectation_min"), 0)
    c_max = safe_float(signals.get("salary_expectation_max"), 0)
    
    if c_min == 0:
        return 0.5
    
    # Overlap ratio
    overlap_start = max(jd_min, c_min)
    overlap_end = min(jd_max, c_max) if jd_max > 0 else c_max
    if overlap_end < overlap_start:
        return 0.2  # no overlap → poor fit
    return clamp((overlap_end - overlap_start) / max(jd_max - jd_min, 1))


def score_signal_modifier(signals: Dict[str, Any], jd: Dict[str, Any] = None) -> float:
    signals = signals or {}
    jd = jd or {}

    github = safe_float(signals.get("github_activity_score"), -1.0)
    github_score = 0.0 if github < 0 else clamp(github / 100.0)

    response_rate = clamp(safe_float(signals.get("recruiter_response_rate")))
    interview_completion = clamp(safe_float(signals.get("interview_completion_rate")))

    assessments = signals.get("skill_assessment_scores") or {}
    if assessments:
        assessment_score = clamp(mean(safe_float(value) for value in assessments.values()) / 100.0)
    else:
        assessment_score = 0.5

    offer = safe_float(signals.get("offer_acceptance_rate"), -1.0)
    offer_score = 0.5 if offer < 0 else clamp(offer)

    completeness = safe_float(signals.get("profile_completeness_score"), 0.0)
    completeness_score = clamp(completeness / 100.0)

    salary_fit = score_salary_fit(signals, jd)

    SIGNAL_WEIGHTS = {
        "github_score": 0.1,
        "response_rate": 0.4,
        "interview_completion": 0.1,
        "assessment_score": 0.1,
        "offer_score": 0.1,
        "completeness_score": 0.1,
        "salary_fit": 0.1,
    }

    weighted_sum = (
        github_score * SIGNAL_WEIGHTS["github_score"] +
        response_rate * SIGNAL_WEIGHTS["response_rate"] +
        interview_completion * SIGNAL_WEIGHTS["interview_completion"] +
        assessment_score * SIGNAL_WEIGHTS["assessment_score"] +
        offer_score * SIGNAL_WEIGHTS["offer_score"] +
        completeness_score * SIGNAL_WEIGHTS["completeness_score"] +
        salary_fit * SIGNAL_WEIGHTS["salary_fit"]
    )
    return clamp(weighted_sum)


def score_availability(signals: Dict[str, Any]) -> float:
    signals = signals or {}

    open_to_work = 1.0 if signals.get("open_to_work_flag") else 0.5
    notice_days = safe_float(signals.get("notice_period_days"), 180.0)
    notice_score = clamp(math.exp(-notice_days / 60.0))
    relocation = 1.0 if signals.get("willing_to_relocate") else 0.6

    return clamp(mean([open_to_work, notice_score, relocation]))
