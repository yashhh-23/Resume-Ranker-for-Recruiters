import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "status" in response.json()


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "model" in data
    assert "uptime_seconds" in data


def test_rank_missing_data(client):
    response = client.post("/rank", json={"job_description": "", "candidates": []})
    assert response.status_code == 400


def test_rank_flow(client):
    # A simple mock candidate profile
    candidate = {
        "candidate_id": "CAND_0000001",
        "profile": {
            "anonymized_name": "Test Candidate",
            "headline": "Software Engineer",
            "summary": "Experienced Python and SQL developer",
            "years_of_experience": 5.0,
            "current_title": "Software Engineer",
            "current_company": "Google",
            "current_industry": "Software"
        },
        "career_history": [
            {
                "company": "Google",
                "title": "Software Engineer",
                "start_date": "2021-01-01",
                "end_date": None,
                "duration_months": 60,
                "is_current": True,
                "description": "Developed web APIs using Python, FastAPI, and PostgreSQL."
            }
        ],
        "education": [
            {
                "institution": "Stanford University",
                "degree": "Bachelor of Science",
                "field_of_study": "Computer Science",
                "tier": "tier_1"
            }
        ],
        "skills": [
            {"name": "Python", "proficiency": "expert", "duration_months": 60},
            {"name": "SQL", "proficiency": "advanced", "duration_months": 48}
        ],
        "redrob_signals": {
            "recruiter_response_rate": 0.9,
            "github_activity_score": 80
        }
    }
    
    payload = {
        "job_description": "We are looking for a Software Engineer with Python and SQL experience.",
        "candidates": [candidate]
    }
    
    # Test /rank endpoint returns clean candidates JSON
    response = client.post("/rank", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "ranked_candidates" in data
    ranked = data["ranked_candidates"]
    assert len(ranked) >= 1
    assert ranked[0]["candidate_id"] == "CAND_0000001"
