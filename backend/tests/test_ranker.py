from ranker.validators import sanitize_candidates
from ranker.jd_parser import parse_jd_text
from ranker.candidate_scorer import score_career_fit, score_education, rank_candidates
from ranker.signal_scorer import score_availability
import numpy as np


def test_sanitize_candidates():
    candidates = [{"id": 1}, {"candidate_id": "C1", "name": "Test"}]
    valid, skipped = sanitize_candidates(candidates)
    assert len(valid) == 1
    assert len(skipped) == 1
    assert valid[0]["candidate_id"] == "C1"


def test_parse_jd_text():
    text = "Required: Python, SQL. Preferred: Docker."
    jd = parse_jd_text(text)
    assert "Python" in jd["required_skills"]
    assert "SQL" in jd["required_skills"]
    assert "Docker" in jd["preferred_skills"]


def test_score_education():
    jd = {"target_field": "Computer Science"}
    cand_no_edu_no_exp = {"education": [], "profile": {"years_of_experience": 0}}
    assert score_education(cand_no_edu_no_exp, jd) == 0.0

    cand_no_edu_low_exp = {"education": [], "profile": {"years_of_experience": 2}}
    assert score_education(cand_no_edu_low_exp, jd) == 0.1

    cand_no_edu_med_exp = {"education": [], "profile": {"years_of_experience": 7}}
    assert score_education(cand_no_edu_med_exp, jd) == 0.3

    cand_no_edu_high_exp = {"education": [], "profile": {"years_of_experience": 12}}
    assert score_education(cand_no_edu_high_exp, jd) == 0.5

    cand_phd = {
        "education": [
            {"degree": "PhD", "field_of_study": "Computer Science", "tier": "tier_1"}
        ]
    }
    assert score_education(cand_phd, jd) > 0.8


def test_score_career_fit():
    jd = {"target_title": "Engineer", "min_experience_years": 5.0}
    cand_1_role = {
        "profile": {"years_of_experience": 6.0},
        "career_history": [{"title": "Software Engineer", "start_date": "2020-01-01"}],
    }
    cand_6_roles = {
        "profile": {"years_of_experience": 6.0},
        "career_history": [{"title": "Software Engineer", "start_date": "2020-01-01"}]
        * 6,
    }
    score_1 = score_career_fit(cand_1_role, jd)
    score_6 = score_career_fit(cand_6_roles, jd)
    assert score_1 > 0.0
    assert abs(score_1 - score_6) < 0.01


def test_score_availability():
    signals = {"open_to_work_flag": True, "notice_period_days": 30}
    assert score_availability(signals) > 0.5


def test_score_signal_modifier():
    from ranker.signal_scorer import score_signal_modifier

    # Full signals — should score high
    signals_full = {
        "github_activity_score": 80,
        "recruiter_response_rate": 0.9,
        "interview_completion_rate": 0.85,
        "skill_assessment_scores": {"python": 90, "sql": 85},
        "offer_acceptance_rate": 0.8,
        "profile_completeness_score": 95,
        "salary_expectation_min": 80000,
        "salary_expectation_max": 110000,
    }
    jd = {"salary_min": 90000, "salary_max": 120000}
    score_full = score_signal_modifier(signals_full, jd)
    assert score_full > 0.6

    # Empty signals — should not crash, returns neutral baseline
    score_empty = score_signal_modifier({}, {})
    assert 0.0 <= score_empty <= 1.0

    # String signal values — safe_float coercion test
    signals_str = {"github_activity_score": "high", "recruiter_response_rate": "medium"}
    score_str = score_signal_modifier(signals_str, {})
    assert 0.0 <= score_str <= 1.0  # must not crash


def test_sanitize_truncation():
    from ranker.validators import sanitize_candidates

    long_headline = "A" * 5000
    c = {"candidate_id": "C99", "profile": {"headline": long_headline}}
    valid, skipped = sanitize_candidates([c])
    assert len(valid) == 1
    assert len(valid[0]["profile"]["headline"]) <= 2000


def test_build_reasoning_empty_title():
    from ranker.candidate_scorer import build_reasoning

    jd = {"target_title": "", "required_skills": []}
    candidate = {
        "profile": {"current_title": "Engineer", "years_of_experience": 3},
        "skills": [],
        "redrob_signals": {},
    }
    breakdown = {
        "skill_match": 0.5,
        "career_fit": 0.4,
        "signal_modifier": 0.3,
        "education": 0.2,
        "availability": 0.1,
    }
    result = build_reasoning(candidate, breakdown, jd)  # must not raise IndexError
    assert isinstance(result, str)


def test_rank_candidates():
    jd = {"skills_text": "Python"}
    cands = [{"candidate_id": "C1", "skills": [{"name": "Python"}]}]

    class DummyModel:
        def encode(self, texts, **kwargs):
            return np.ones((len(texts), 384))

    res = rank_candidates(cands, jd, model=DummyModel(), cache_path=".test_cache.pkl")
    assert len(res) == 1
