from ranker.validators import sanitize_candidates
from ranker.jd_parser import parse_jd_text

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
