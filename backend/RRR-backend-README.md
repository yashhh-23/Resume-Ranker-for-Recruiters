# RRR - Resume Ranker Recruiter Backend

This backend now follows `RRR-backend-PRD-final.md`.

Implemented:

- `rank.py` CLI entrypoint
- `ranker/` package with JD parsing, embedding cache, candidate scoring, and Redrob signal scoring
- `app/main.py` FastAPI wrapper
- `data/sample_candidates.json`
- `data/job_description.docx`
- `Dockerfile`
- `submission_metadata.yaml`
- `.gitignore`
- `validate_submission.py`

Run:

```powershell
.\.venv\Scripts\python.exe rank.py --candidates .\data\sample_candidates.json --out .\submission.csv
```

Serve API:

```powershell
.\.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

Main docs are in `README.md`.
