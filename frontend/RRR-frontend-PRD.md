# PRD - RRR Frontend and Ranking Flow

**Repo:** `RRR-Resume-Ranker-Recruiter-Frontend`  
**Hackathon:** Hack2Skill - Intelligent Candidate Discovery & Ranking Challenge  
**Implemented Stack:** Vite, React 18, Tailwind CSS  
**Backend Contract:** FastAPI `GET /health`, `POST /rank`  
**Version:** 1.1 as-built

## 1. Overview

RRR is a recruiter-facing dashboard that ingests a job description and candidate dataset, ranks candidates through the backend API, and presents a top-100 shortlist with score context, filters, anomaly detection, and candidate profile exploration.

The current app is a single-page Vite React application. It does not use Next.js routes, Recharts, or a Next.js API proxy.

## 2. Goals

- Let judges or recruiters load a JD and candidate feed quickly.
- Support `.json`, `.jsonl`, and `.jsonl.gz` candidate files.
- Call the FastAPI backend when `VITE_API_URL` is configured.
- Preserve demo usability with a browser-side fallback ranker if the backend is unavailable.
- Show ranking evidence through score bars, reasoning text, skills, Redrob signals, and timeline anomaly flags.
- Validate that ranked output satisfies the expected top-100 submission structure.
- Work across desktop and mobile with a split desktop workspace and tabbed mobile workflow.

## 3. Out of Scope

- Authentication and user accounts.
- Persisting past ranking sessions.
- Editing candidate source profiles.
- Manual scoring weight controls.
- Exporting CSV from the UI.
- Full five-axis chart visualization. The current UI displays three grouped axes: skill, semantic, and activity.

## 4. User Flow

1. User opens the dashboard.
2. App checks `{VITE_API_URL}/health` and shows API status.
3. User pastes a job description or loads the demo JD.
4. User uploads candidates or loads `public/sample_candidates.json`.
5. User runs the discovery matrix.
6. App calls `POST {VITE_API_URL}/rank`.
7. If the API succeeds, results are normalized and displayed.
8. If the API fails, the app computes local fallback rankings and shows a warning.
9. User searches, filters, sorts, and opens candidate details.
10. Compliance tray validates top-100 row count, unique IDs, rank uniqueness, score ordering, and tie-break order.

## 5. Functional Requirements

### 5.1 Input Panel

Source: `src/components/InputPanel.jsx`

Requirements:

- Textarea for raw job description text.
- File upload and drag/drop for `.json`, `.jsonl`, `.jsonl.gz`.
- Demo loader that fills a backend/data-engineer JD and loads sample candidates.
- API status badge:
  - connected
  - local engine/fallback
  - connecting
- Run button disabled while loading or when no candidates are loaded.
- Parse progress count while reading candidate files.

### 5.2 Candidate Parsing

Source: `src/utils/jsonlParser.js`

Requirements:

- Parse JSON array files.
- Parse newline-delimited JSON files.
- Parse gzipped JSONL when the browser supports `DecompressionStream`.
- Cap parsed rows at `100000` for browser performance.
- Return clear parse errors for invalid JSON/JSONL.

### 5.3 Ranking API Integration

Source: `src/api/rankApi.js`

Environment variable:

```env
VITE_API_URL=http://localhost:8000
```

Request:

```json
{
  "job_description": "Job description text",
  "candidates": []
}
```

Accepted response shapes:

- `[]`
- `{ "results": [] }`
- `{ "ranked_results": [] }`
- `{ "rankedCandidates": [] }`
- `{ "ranked_candidates": [] }`

Normalized row shape:

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

### 5.4 Local Fallback Ranking

Source: `src/utils/scoreUtils.js`

Fallback is used when:

- `VITE_API_URL` is unset.
- Health check fails.
- `POST /rank` fails.
- API returns an empty result set.

Local fallback score:

```text
score = skill * 0.45 + semantic * 0.35 + activity * 0.20
```

Fallback axes:

- `skill`: skill assessments plus skill count.
- `semantic`: years of experience plus career history depth.
- `activity`: response rate, profile completeness, GitHub activity.

### 5.5 Results Panel

Source: `src/components/ResultsPanel.jsx`

Requirements:

- Display shortlist statistics:
  - result count
  - average fit score
  - notice-period availability percentage
  - anomaly count
- Search by candidate name, headline, company, title, and location.
- Sort by rank, experience, notice period, profile completeness, or skill count.
- Filter by:
  - notice period <= 30 days
  - GitHub attached
  - hide anomalies
  - anomalies only
- Render candidate cards in ranked order by default.

### 5.6 Candidate Card

Source: `src/components/CandidateCard.jsx`

Requirements:

- Display rank, candidate name, ID, headline, current title/company/location.
- Show formatted fit score.
- Show grouped score bar:
  - skill congruence
  - semantic sequence
  - platform activity
- Show reasoning text and top four skills.
- Flag employment chronology anomalies.

### 5.7 Candidate Modal

Source: `src/components/CandidateModal.jsx`

Requirements:

- Slide-in detail panel.
- Show overall score and grouped score percentages.
- Show reasoning.
- Show employment timeline with duration/overlap anomalies.
- Show skills ledger with declared proficiency and Redrob assessment score.
- Show availability, compensation, work mode, engagement, verification, and activity signals.

### 5.8 Compliance Tray

Source: `src/components/ComplianceTray.jsx`, `src/utils/validation.js`

Validation requirements:

- Exactly 100 ranked rows.
- Unique `candidate_id`.
- `candidate_id` matches `CAND_XXXXXXX`.
- Unique ranks from 1 to 100.
- Scores are non-increasing by rank.
- Equal scores are tie-broken by `candidate_id` ascending.

## 6. Backend Scoring Contract

The backend implementation in `RRR-Resume-Ranker-Recruiter-Backend/app/main.py` uses `deterministic_weighted_v1`.

Backend score:

```text
score =
  skill_match * 0.35 +
  career_fit * 0.25 +
  signal_modifier * 0.15 +
  education * 0.15 +
  availability * 0.10
```

Backend components:

| Component | Weight | Data used |
|---|---:|---|
| Skill Match | 35% | Skills, proficiency, endorsements, duration, assessments, JD token overlap |
| Career Fit | 25% | Profile text, career descriptions, title/industry match, experience, recency |
| Signal Modifier | 15% | Response rate, interview completion, completeness, GitHub, activity, verification |
| Education | 15% | Institution tier and education field match |
| Availability | 10% | Notice period, open-to-work, relocation, preferred work mode |

The backend returns both grouped UI keys and full model keys:

- `skill`
- `semantic`
- `activity`
- `skill_match`
- `career_fit`
- `signal_modifier`
- `education`
- `availability`

## 7. Component Architecture

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
```

## 8. Acceptance Criteria

- Upload JD and candidates, run ranking, and render results.
- Backend responds successfully to `/health` and `/rank`.
- Frontend consumes backend results through `VITE_API_URL`.
- Fallback ranking works when backend is unavailable.
- Results can be searched, sorted, and filtered.
- Candidate modal opens with career, skills, and Redrob signal details.
- Compliance tray reflects top-100 submission readiness.
- Production build completes with `npm run build`.
