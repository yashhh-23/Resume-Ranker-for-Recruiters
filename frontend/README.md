# RRR - Resume Ranker Recruiter Frontend

Vite + React recruiter dashboard for uploading a job description and candidate dataset, calling the ranking backend, and reviewing a top-100 candidate shortlist.

## Tech Stack

- Vite
- React 18
- Tailwind CSS
- Browser-side JSON/JSONL/Gzip parsing
- FastAPI backend integration through `VITE_API_URL`

## Getting Started

```powershell
npm install
```

Create `.env.local`:

```env
VITE_API_URL=http://localhost:8000
```

Run locally:

```powershell
npm run dev
```

Open `http://localhost:5173/`.

Production build:

```powershell
npm run build
```

## How It Works

1. Paste a job description.
2. Upload a candidate file (`.json`, `.jsonl`, or `.jsonl.gz`) or load the included hackathon demo dataset.
3. Click **Run Candidate Discovery Matrix**.
4. The frontend calls `POST {VITE_API_URL}/rank`.
5. If the backend is unavailable, the app computes a local fallback ranking in the browser.
6. Ranked candidates render with fit scores, score breakdowns, filters, anomaly flags, and a candidate detail modal.

## Main UI Surfaces

| Surface | Source | Description |
|---|---|---|
| Input panel | `src/components/InputPanel.jsx` | Job description editor, file upload, demo loader, API status |
| Results panel | `src/components/ResultsPanel.jsx` | Search, filters, sorting, ranked cards, shortlist stats |
| Candidate card | `src/components/CandidateCard.jsx` | Rank, profile summary, score bar, skills, anomaly warning |
| Candidate modal | `src/components/CandidateModal.jsx` | Career trace, skills ledger, Redrob signals, reasoning |
| Compliance tray | `src/components/ComplianceTray.jsx` | Validates top-100 submission structure |

## API Contract

The frontend sends:

```json
{
  "job_description": "Backend Engineer with Python, SQL, Spark...",
  "candidates": []
}
```

The frontend accepts any of these response shapes:

- An array of ranked rows
- `{ "results": [] }`
- `{ "ranked_results": [] }`
- `{ "rankedCandidates": [] }`
- `{ "ranked_candidates": [] }`

Each ranked row should include:

```json
{
  "candidate_id": "CAND_0000001",
  "rank": 1,
  "score": 0.8123,
  "reasoning": "Backend Engineer with 6.9 yrs; 12 skills; strongest signal: skill match; response rate 0.71; notice 30 days.",
  "breakdown": {
    "skill": 0.84,
    "semantic": 0.76,
    "activity": 0.69
  }
}
```

If the backend also returns `skill_match`, `career_fit`, `signal_modifier`, `education`, and `availability`, they are preserved in the payload but the current UI displays the three grouped frontend axes: skill, semantic, and activity.

## Local Fallback Ranking

When `VITE_API_URL` is missing or the API request fails, `src/utils/scoreUtils.js` ranks candidates locally using:

- skill assessment scores and skill count
- years of experience and career history length
- recruiter response rate, profile completeness, and GitHub activity

This keeps the demo usable even without a running backend.

## Project Structure

```text
src/
  api/
    rankApi.js
  components/
    CandidateCard.jsx
    CandidateModal.jsx
    ComplianceTray.jsx
    InputPanel.jsx
    ResultsPanel.jsx
    ScoreBar.jsx
  utils/
    formatters.js
    jsonlParser.js
    scoreUtils.js
    validation.js
  App.jsx
  index.css
  main.jsx
public/
  sample_candidates.json
```

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL for the FastAPI backend, for example `http://localhost:8000` |

## Local Production Preview

To build and preview the app locally:

```powershell
npm run build
npm run preview
```

By default, the app is configured to talk to your local backend at `http://localhost:8000`. You can also configure `VITE_API_URL` to point to a demo deployment like a Hugging Face Space.
