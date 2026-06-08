# RRR - Resume Ranker Recruiter Backend

Offline Python ranking engine for the Hack2Skill Intelligent Candidate Discovery challenge. It scores candidates against a job description across five weighted signals and writes a valid `submission.csv`. A FastAPI wrapper exposes the same ranking logic for the frontend demo.

## Tech Stack

- Python 3.11
- `sentence-transformers` (`all-MiniLM-L6-v2`)
- `numpy`, `pandas`, `scikit-learn`
- `python-docx`
- FastAPI + Uvicorn

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

The first ranking run downloads `sentence-transformers/all-MiniLM-L6-v2`. After that, ranking can run offline from the local model/cache.

## Run CLI Ranker

```powershell
.\.venv\Scripts\python.exe rank.py --candidates .\data\sample_candidates.json --out .\submission.csv
```

Optional arguments:

| Arg | Default | Description |
|---|---|---|
| `--candidates` | required | Candidate JSON or JSONL path |
| `--jd` | `data/job_description.docx` | Job description docx path |
| `--out` | `submission.csv` | Output CSV path |
| `--cache` | `.embedding_cache.pkl` | Candidate embedding cache path |

Validate:

```powershell
.\.venv\Scripts\python.exe validate_submission.py .\submission.csv
```

## Run API

```powershell
.\.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

Endpoints:

- `GET /`
- `GET /health`
- `POST /rank`
- `GET /docs`

## API Response

`POST /rank` returns both PRD and frontend-compatible keys:

```json
{
  "ranked_candidates": [
    {
      "rank": 1,
      "candidate_id": "CAND_0000001",
      "score": 0.8123,
      "score_breakdown": {
        "skill_match": 0.88,
        "career_fit": 0.91,
        "signal_modifier": 0.74,
        "education": 0.75,
        "availability": 0.83
      },
      "breakdown": {
        "skill": 0.88,
        "semantic": 0.91,
        "activity": 0.74
      },
      "reasoning": "Backend Engineer with 6.1 yrs; 9 skills; top signal career fit; response rate 0.76."
    }
  ],
  "results": []
}
```

## Scoring Model

```text
final_score =
  0.35 * skill_match_score
+ 0.25 * career_fit_score
+ 0.15 * signal_modifier
+ 0.15 * education_score
+ 0.10 * availability_score
```

| Component | Weight | Method |
|---|---:|---|
| Skill Match | 35% | Sentence-transformer cosine similarity between JD skills text and candidate skill/profile text |
| Career Fit | 25% | Recency-decayed title and industry match, cap+clip normalized |
| Signal Modifier | 15% | GitHub, recruiter response, interview completion, assessments, offer acceptance |
| Education | 15% | Institution tier multiplied by field-of-study match |
| Availability | 10% | Open to work, notice period, relocation willingness |

## Project Structure

```text
rank.py
ranker/
  __init__.py
  jd_parser.py
  candidate_scorer.py
  embedding_utils.py
  signal_scorer.py
app/
  main.py
data/
  sample_candidates.json
  job_description.docx
Dockerfile
requirements.txt
submission_metadata.yaml
validate_submission.py
```

## Deployment

Deploy to HuggingFace Spaces using Docker runtime. The provided `Dockerfile` starts FastAPI on port `7860`.

Set CORS origins with:

```env
RRR_ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

## Compute Metadata

```yaml
compute:
  uses_gpu_for_inference: false
  has_network_during_ranking: false
```
