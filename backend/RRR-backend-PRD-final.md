# PRD — RRR Backend (Ranking Engine)

**Repo:** `RRR-Resume-Ranker-Recruiter-Backend`  
**Hackathon:** Hack2Skill — Intelligent Candidate Discovery & Ranking Challenge  
**Stack:** Python 3.11, FastAPI, sentence-transformers  
**Deployment:** HuggingFace Spaces (sandbox) + local CLI  
**Version:** 1.1 (Finalised)

---

## 1. Overview

A Python-based offline ranking engine that reads a job description and ~5000 candidate profiles, scores each candidate across 5 weighted signals, and outputs a ranked `submission.csv`. A lightweight FastAPI wrapper exposes the same logic as a REST API for the frontend sandbox demo.

---

## 2. Goals

- Rank candidates semantically — not by keyword overlap
- All ranking runs fully offline (no network calls during inference)
- Must complete within 5 minutes on 16GB RAM CPU
- Output matches the exact `submission.csv` format required by the hackathon
- FastAPI layer serves the frontend demo on HuggingFace Spaces

---

## 3. Hard Constraints (From Submission Spec)

| Constraint | Requirement |
|---|---|
| `uses_gpu_for_inference` | `false` — CPU only |
| `has_network_during_ranking` | `false` — no API calls during scoring |
| Max runtime | 5 minutes for ~5000 candidates on 16GB RAM |
| Score format | 0.0–1.0 (4 decimal places) |
| Output format | `candidate_id, rank, score, reasoning` CSV |

---

## 4. Dataset Fields Used

| Signal | Field Path | Used In |
|---|---|---|
| Headline + Summary | `profile.headline`, `profile.summary` | Skill match embedding |
| Career descriptions | `career_history[].description`, `.title`, `.industry` | Career fit score |
| Skills | `skills[].name`, `.proficiency`, `.endorsements`, `.duration_months` | Skill match embedding |
| Years of experience | `profile.years_of_experience` | Career fit |
| Education | `education[].tier`, `.field_of_study` | Education score |
| Assessment scores | `redrob_signals.skill_assessment_scores` | Signal modifier |
| GitHub activity | `redrob_signals.github_activity_score` | Signal modifier |
| Recruiter response rate | `redrob_signals.recruiter_response_rate` | Signal modifier |
| Interview completion | `redrob_signals.interview_completion_rate` | Signal modifier |
| Offer acceptance rate | `redrob_signals.offer_acceptance_rate` | Signal modifier |
| Open to work | `redrob_signals.open_to_work_flag` | Availability score |
| Notice period | `redrob_signals.notice_period_days` | Availability score |
| Willing to relocate | `redrob_signals.willing_to_relocate` | Availability score |

---

## 5. Scoring Model

### Final Score Formula

```
final_score =
  0.35 × skill_match_score
+ 0.25 × career_fit_score
+ 0.15 × signal_modifier
+ 0.15 × education_score
+ 0.10 × availability_score
```

All component scores are normalized to 0.0–1.0 before weighting.

---

### 5.1 Skill Match Score (0.35)

- Embed JD skills text using `sentence-transformers/all-MiniLM-L6-v2`
- Embed each candidate's skill list (`name + proficiency + duration_months`)
- Compute cosine similarity between the two embeddings
- Cache all candidate embeddings to `.embedding_cache.pkl` on first run (~2 min); subsequent runs ~0.1s

---

### 5.2 Career Fit Score (0.25)

- Exponential decay weighting: recent roles count more
- Decay factor: `e^(-0.3 × years_ago)` — a role from 5 years ago contributes ~22% of a current role
- Per role: `decay × (0.6 × title_match + 0.4 × industry_match)`
- **Normalization:** Cap + clip — divide raw sum by a theoretical maximum, then clip to [0.0, 1.0]:

```python
MAX_CAREER_SCORE = 3.0   # empirically set; tune after first run on full dataset
career_score = min(raw_career_score / MAX_CAREER_SCORE, 1.0)
```

Using cap + clip (not pool-based min-max) ensures the same candidate always receives the same score regardless of who else is in the batch.

---

### 5.3 Signal Modifier (0.15)

Combine 5 Redrob platform signals:

| Signal | Handling |
|---|---|
| `github_activity_score` | Divide by 100; treat `-1` as `0.0` (not eliminated) |
| `recruiter_response_rate` | Already 0–1 |
| `interview_completion_rate` | Already 0–1 |
| `skill_assessment_scores` | Mean of all assessment values ÷ 100; `0.5` if empty dict |
| `offer_acceptance_rate` | Already 0–1; treat `-1` as neutral `0.5` (no offer history) |

Final signal score = mean of the 5 values above.

---

### 5.4 Education Score (0.15)

Tier weights:

| Tier | Weight |
|---|---|
| tier_1 (IIT/IIM level) | 1.0 |
| tier_2 | 0.75 |
| tier_3 | 0.5 |
| tier_4 | 0.3 |
| unknown | 0.2 |

Multiplied by field-of-study match (1.0 if matches JD field, 0.4 otherwise). Take max score across all education entries per candidate.

---

### 5.5 Availability Score (0.10)

- `open_to_work_flag`: 1.0 if true, 0.5 if false
- `notice_period_days`: `1 - (days / 180)` — shorter notice = higher score
- `willing_to_relocate`: 1.0 if true, 0.6 if false
- Final = mean of the 3 above

---

## 6. JD Parser — `jd_parser.py`

Parses `job_description.docx` using `python-docx`. Must return the following dict:

```python
{
  "required_skills":      ["Python", "NLP", "TensorFlow", ...],   # hard requirements
  "preferred_skills":     ["Docker", "MLflow", ...],              # nice-to-have
  "target_title":         "ML Engineer",                          # primary role title
  "min_experience_years": 3,                                      # integer, default 0 if not found
  "target_industry":      "Technology",                           # default "Any" if not found
  "target_field":         "Computer Science",                     # for education scoring
  "skills_text": "Python NLP TensorFlow Docker MLflow ..."        # flat string for embedding
}
```

**Parsing rules:**
- Extract text from all paragraphs and table cells in the docx
- Use regex/keyword anchors to detect sections (`Required`, `Preferred`, `Experience`, `Industry`)
- If a field cannot be parsed, fall back to safe defaults (listed above) — never raise an exception
- `skills_text` = join of required + preferred skills, deduplicated, space-separated

---

## 7. Entrypoint — `rank.py`

Single CLI script. No network required.

```bash
python rank.py --candidates ./data/sample_candidates.json --out ./submission.csv
```

Arguments:

| Arg | Default | Description |
|---|---|---|
| `--candidates` | required | Path to candidates JSON |
| `--jd` | `data/job_description.docx` | Path to JD docx |
| `--out` | `submission.csv` | Output CSV path |

**Runtime flow:**
1. Parse JD → extract fields dict
2. Load `all-MiniLM-L6-v2` model
3. Compute/load cached JD embedding
4. Compute/load cached candidate embeddings
5. Score all candidates (5 components)
6. Sort by `final_score` descending → assign ranks 1–N
7. Write `submission.csv`
8. Print summary: total candidates, runtime, top 5 IDs

---

## 8. API Endpoints (FastAPI — Demo Sandbox Only)

### `POST /rank`

```json
// Request
{
  "job_description": "...",
  "candidates": [...]
}

// Response
{
  "ranked_candidates": [
    {
      "rank": 1,
      "candidate_id": "CAND_0004989",
      "score": 0.9920,
      "score_breakdown": {
        "skill_match": 0.88,
        "career_fit": 0.91,
        "signal_modifier": 0.74,
        "education": 0.75,
        "availability": 0.83
      },
      "reasoning": "HR Manager with 6.1 yrs; 9 AI core skills; response rate 0.76."
    }
  ]
}
```

### `GET /health`

Returns `{ "status": "ok" }` — used by frontend to check backend is alive.

**CORS:** Allow Vercel frontend domain only.

---

## 9. Folder Structure

```
RRR-Resume-Ranker-Recruiter-Backend/
├── rank.py                    ← CLI entrypoint (graded submission)
├── ranker/
│   ├── __init__.py
│   ├── jd_parser.py           ← Parses job_description.docx → dict
│   ├── candidate_scorer.py    ← Orchestrates all 5 components
│   ├── embedding_utils.py     ← Loads model, caches embeddings
│   └── signal_scorer.py       ← Normalizes redrob_signals to 0–1
├── app/
│   └── main.py                ← FastAPI server (demo only)
├── data/
│   ├── sample_candidates.json
│   └── job_description.docx
├── Dockerfile                 ← For HuggingFace Spaces Docker runtime
├── requirements.txt
├── .gitignore                 ← Must include submission.csv, .embedding_cache.pkl
├── submission_metadata.yaml
└── README.md
```

---

## 10. Dependencies

```
sentence-transformers==2.7.0
scikit-learn>=1.3.0
pandas>=2.0.0
numpy>=1.24.0
python-docx>=1.1.0
pyyaml>=6.0
fastapi
uvicorn
```

---

## 11. `.gitignore` Entries

```
submission.csv
.embedding_cache.pkl
__pycache__/
*.pyc
.env
```

---

## 12. Submission Metadata

```yaml
team_name: "RRR-Team"
github_repo: "https://github.com/your-username/RRR-Resume-Ranker-Recruiter-Backend"
sandbox_link: "https://huggingface.co/spaces/YOUR_USERNAME/redrob-ranker"
reproduce_command: "python rank.py --candidates ./data/sample_candidates.json --out ./submission.csv"
compute:
  uses_gpu_for_inference: false
  has_network_during_ranking: false
```

---

## 13. Acceptance Criteria

| Criteria | Type | Pass Condition |
|---|---|---|
| `rank.py` runs fully offline | Automated | No network errors, exits 0 |
| Output CSV format correct | Automated (`validate_submission.py`) | No validation errors |
| Scores are 0.0–1.0 (4 decimal places) | Automated | All values in range |
| All 5 scoring components contribute | Manual code review | Each weight > 0 in final formula |
| `validate_submission.py` passes | Automated | Exit code 0 |
| Completes in under 5 minutes on CPU | Manual timing | `time python rank.py ...` < 300s |
| FastAPI `/rank` endpoint works | Manual demo | Frontend can call and render results |
| Deployed on HuggingFace Spaces | Manual check | Sandbox URL returns 200 on `/health` |

---

*Built for Hack2Skill — Intelligent Candidate Discovery & Ranking Challenge.*
