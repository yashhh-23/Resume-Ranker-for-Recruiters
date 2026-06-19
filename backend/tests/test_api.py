from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_rank_missing_data():
    response = client.post("/rank", json={"job_description": "", "candidates": []})
    assert response.status_code == 422 # Pydantic validation error or 400
