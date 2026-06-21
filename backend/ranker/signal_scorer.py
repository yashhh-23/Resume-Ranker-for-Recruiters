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


def score_signal_modifier(signals: Dict[str, Any]) -> float:
    signals = signals or {}

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

    return clamp(mean([github_score, response_rate, interview_completion, assessment_score, offer_score, completeness_score]))


def score_availability(signals: Dict[str, Any]) -> float:
    signals = signals or {}

    open_to_work = 1.0 if signals.get("open_to_work_flag") else 0.5
    notice_days = safe_float(signals.get("notice_period_days"), 180.0)
    notice_score = clamp(1.0 - (notice_days / 180.0))
    relocation = 1.0 if signals.get("willing_to_relocate") else 0.6

    return clamp(mean([open_to_work, notice_score, relocation]))
