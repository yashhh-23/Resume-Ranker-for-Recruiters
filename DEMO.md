# RRR — Resume Ranker for Recruiters

Welcome to **Resume Ranker for Recruiters (RRR)**, the Rank #1 recruitment optimization platform. RRR uses local semantic embeddings, multi-signal candidate scoring, and visual explanation mechanics to find the best talent.

## Live Demo Links
- 🔗 **Frontend Workspace**: [https://rrr-recruiter.vercel.app](https://rrr-recruiter.vercel.app) *(or your deployment URL)*
- 🔗 **Backend API Sandbox**: [https://rrr-backend-api.onrender.com](https://rrr-backend-api.onrender.com) *(or your deployment URL)*

---

## Quick Start (Run Locally in 2 Minutes)

### 1. Run the FastAPI Backend
```bash
cd backend
# Setup virtual environment
python -m venv .venv
# Activate environment
# On Windows:
.venv\Scripts\activate
# On Unix:
source .venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Run the FastAPI server
python -m uvicorn app.main:app --reload --port 8000
```
*The backend API server will spin up at `http://localhost:8000`.*

### 2. Run the React/Vite Frontend
```bash
cd frontend
# Install dependencies (recharts, crypto-js, etc.)
npm install

# Start the dev server
npm run dev
```
*Open your browser and navigate to `http://localhost:5173` to interact with the workspace.*

---

## 3-Minute Judge walkthrough

1. **Passphrase Access**: Type a private passphrase (e.g. `hackathon2026`) in the **PassphraseGate**. RRR secures all talent pools locally using **AES-256 client-side encryption**.
2. **Setup Inputs**:
   - Paste a Job Description or click the **Load Hackathon Demo** button to ingest mock requirements (Backend / Data Engineer).
   - Drop the `sample_candidates.json` file or click load demo to ingest mock candidate profiles.
3. **Execute Ranker**: Click the **Run Candidate Discovery Matrix** button.
   - Watch the animated **Staged Loading UX** cycle through embedding, multi-signal calculation, and rank sorting.
4. **Inspect Explanations**:
   - Click any Candidate Card to view their full details, including **Employment Timeline Trace** with automatic logical chronological anomaly indicators, and the **Proficiency-Badged JD Skill Gap Analysis** section.
5. **Head-to-Head Compare**:
   - Check the select box on 2 or 3 candidates.
   - Click the amber **Compare X** button.
   - Interact with the **Recharts Radar Chart Overlay** showing candidates mapped across 5 dimensions, side-by-side quick facts, and dimension score breakdowns.
6. **Export Compliant Submission**: Click the green **CSV** button at the top of the shortlist to download `submission.csv` containing candidate ID, rank, normalized score (0.0-1.0), and reasoning. This file is 100% compliant with the hackathon validation scripts.
7. **Switch Theme**: Toggle between **Dark Mode** and **Light Mode** using the sun/moon button in the top navigation bar.
