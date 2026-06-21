This document is structured as a prioritized sprint plan. Items marked 🔴 are critical and should be done first; 🟡 are high-impact; 🟢 are polish.

---

## Priority 1 — 🔴 Critical Fixes 


### 1.1 Fix the Skill Endorsement Multiplier Bug

**Current code in `candidate_scorer.py`:**
```python
return clamp(base * endorsement_boost * 2.0)
```
The `* 2.0` makes skill scores exceed 1.0 before `clamp()` — meaning candidates with any endorsements are all getting a clamped score of 1.0 regardless of actual semantic similarity. This kills differentiation at the top.

**Fix:**
```python
# In score_skill_match()
# Remove the * 2.0 multiplier
blended = 0.7 * base + 0.3 * endorsement_boost   # weighted blend, never exceeds 1.0
return clamp(blended)
```

### 1.2 Fix `build_reasoning()` — "AI core skills" is Hardcoded

**Current code:**
```python
return (
    f"{title} with {years:.1f} yrs; "
    f"{matched_skills} AI core skills matched; "   # ← "AI core" is hardcoded regardless of JD
    ...
)
```
If the JD is for a "Java Backend Engineer" and your reasoning says "AI core skills matched", judges will notice it's a template string, not actually reasoning.

**Fix:**
```python
# Use the JD's target_title to describe the domain
domain = jd.get("target_title", "core") or "core"
domain_label = domain.split()[0] if domain else "core"

return (
    f"{title} with {years:.1f} yrs; "
    f"{matched_skills} {domain_label} skills matched; "
    f"top signal {top_component}; "
    f"response rate {response_rate:.2f}."
)
```

---

## Priority 2 — 🟡 Scoring Algorithm Improvements

### 2.1 Add Skill Proficiency Weighting

**Current:** All skills treated equally in the embedding.  
**Better:** Expert-level skills should contribute more to the semantic match.

In `candidate_scorer.py`, before building the candidate text for embedding, weight skills by proficiency in `embedding_utils.py`:

```python
# In embedding_utils.py → build_candidate_text()
PROFICIENCY_WEIGHT = {
    "expert": 3,
    "advanced": 2,
    "intermediate": 1,
    "beginner": 0.5,
}

def build_candidate_text(candidate: dict) -> str:
    profile = candidate.get("profile") or {}
    skills = candidate.get("skills") or []
    
    # Repeat skill name proportional to proficiency for TF-IDF-like weighting
    skill_tokens = []
    for skill in skills:
        name = skill.get("name", "")
        level = str(skill.get("proficiency", "intermediate")).lower()
        weight = PROFICIENCY_WEIGHT.get(level, 1)
        skill_tokens.extend([name] * int(weight))
    
    title = profile.get("current_title", "")
    industry = profile.get("industry", "")
    summary = profile.get("summary", "")
    
    return f"{title} {industry} {' '.join(skill_tokens)} {summary}"
```

### 2.2 Add Skill Coverage Score (Hard Requirement Matching)

**Current:** Semantic similarity only — a candidate who semantically matches but lacks a hard-required skill (e.g. "must have AWS") still scores high.  
**Addition:** A separate `required_skill_coverage` sub-score:

```python
# In candidate_scorer.py
def score_required_skill_coverage(candidate: dict, jd: dict) -> float:
    required = [s.lower() for s in jd.get("required_skills", [])]
    if not required:
        return 1.0  # no hard requirements = full score
    
    candidate_skills = set(
        s.get("name", "").lower() 
        for s in (candidate.get("skills") or [])
    )
    matched = sum(1 for r in required if any(r in cs or cs in r for cs in candidate_skills))
    return clamp(matched / len(required))
```

Then blend into skill_match:
```python
# score_skill_match becomes:
semantic_score = clamp((cosine_similarity(...) + 1.0) / 2.0)
coverage_score = score_required_skill_coverage(candidate, jd)
blended_skill = 0.65 * semantic_score + 0.20 * coverage_score + 0.15 * endorsement_boost
return clamp(blended_skill)
```

### 2.3 Use Salary Range Compatibility as a Tiebreaker

The dataset has `salary_expectation_min` and `salary_expectation_max` in `redrob_signals`. Currently unused. Add it as a soft tiebreaker signal:

```python
# In signal_scorer.py
def score_salary_fit(signals: dict, jd: dict) -> float:
    """Returns 1.0 if salary expectation is within JD range, else decays."""
    jd_min = safe_float(jd.get("salary_min"), 0)
    jd_max = safe_float(jd.get("salary_max"), 0)
    if jd_min == 0 and jd_max == 0:
        return 0.5  # JD doesn't specify salary → neutral
    
    c_min = safe_float(signals.get("salary_expectation_min"), 0)
    c_max = safe_float(signals.get("salary_expectation_max"), 0)
    
    if c_min == 0:
        return 0.5
    
    # Overlap ratio
    overlap_start = max(jd_min, c_min)
    overlap_end = min(jd_max, c_max) if jd_max > 0 else c_max
    if overlap_end < overlap_start:
        return 0.2  # no overlap → poor fit
    return clamp((overlap_end - overlap_start) / max(jd_max - jd_min, 1))
```

### 2.4 Better JD Parser — Extract Salary and Preferred Skills Separately

**Current `jd_parser.py`** treats required and preferred skills as one pool.  
**Add:** Distinguish `required_skills` (must-have) from `preferred_skills` (nice-to-have) in the parsed JD so `score_required_skill_coverage` can work accurately.

In `jd_parser.py`, add a section detector:
```python
# Look for "Required:" vs "Preferred:" or "Nice to Have:" section headers
REQUIRED_HEADERS = ["required", "must have", "mandatory", "essential"]
PREFERRED_HEADERS = ["preferred", "nice to have", "bonus", "good to have", "desired"]
```

---

## Priority 3 — 🟡 Frontend Improvements

### 3.1 Score Visualization in the Results Panel

**Current:** Results are shown as a ranked list with a score number.  
**Add:** A mini horizontal bar per candidate showing the 5-component breakdown inline (no click required). Recruiters can see at a glance *why* someone ranked there.

```jsx
// In CandidateCard.jsx — add below the score badge:
const ScoreMiniBar = ({ breakdown }) => (
  <div className="flex gap-0.5 h-1.5 w-full rounded-full overflow-hidden mt-1">
    <div style={{ width: `${breakdown.skill_match * 35}%` }} className="bg-blue-500" title="Skill Match" />
    <div style={{ width: `${breakdown.career_fit * 25}%` }} className="bg-green-500" title="Career Fit" />
    <div style={{ width: `${breakdown.signal_modifier * 15}%` }} className="bg-amber-500" title="Signals" />
    <div style={{ width: `${breakdown.education * 15}%` }} className="bg-purple-500" title="Education" />
    <div style={{ width: `${breakdown.availability * 10}%` }} className="bg-red-400" title="Availability" />
  </div>
);
```

### 3.2 JD-Matched Skill Chips on Each Candidate Card

Highlight which of the candidate's skills matched the JD directly on the card — not just inside the modal.

```jsx
// In CandidateCard.jsx
const matchedSkills = candidate.skills
  ?.filter(s => jdSkills.some(j => j.toLowerCase().includes(s.name.toLowerCase())))
  ?.slice(0, 3);

// Render:
{matchedSkills?.map(s => (
  <span key={s.name} className="px-1.5 py-0.5 bg-emerald/20 text-emerald text-[10px] rounded font-mono border border-emerald/30">
    {s.name}
  </span>
))}
```

### 3.3 Add a "Compare 2 Candidates" Mode

Recruiters often want to compare two shortlisted candidates side-by-side. Add a checkbox on each card → selecting two candidates triggers a side-by-side diff modal showing all 5 score components as a radar chart.

```jsx
// Radar chart using Recharts RadarChart
// Show both candidates' score_breakdown overlaid on the same axes:
// Skill Match | Career Fit | Signals | Education | Availability
```

### 3.4 Export Button — Download Top-100 as CSV

Add a single button in the ResultsPanel header that downloads the current ranked results as `submission.csv` — matching the hackathon format (`candidate_id, rank, score, reasoning`).

```js
const exportCSV = (rankedResults) => {
  const rows = rankedResults.map(r => 
    `${r.candidate_id},${r.rank},${r.score},"${r.reasoning}"`
  );
  const csv = ["candidate_id,rank,score,reasoning", ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "submission.csv";
  a.click();
};
```

### 3.5 Improve the Empty State and Loading UX

**Current:** Loading state is likely a spinner.  
**Add:** A skeleton loader that mirrors the actual card layout + a progress message:

```jsx
// While ranking is in progress, show:
"🔍 Embedding 4,891 candidates against JD..."
"⚡ Scoring across 5 dimensions..."
"📊 Sorting top 100..."
```
This makes the system feel intelligent rather than just "loading".

---

## Priority 4 — 🟢 Polish & Demo Excellence

### 4.1 Add a `/benchmark` Endpoint to the Backend

A judge-impressing addition: an endpoint that runs the ranker against `sample_submission.csv` (the hackathon's reference output) and reports a score:

```python
@app.post("/benchmark")
async def benchmark(req: BenchmarkRequest):
    # Compare your submission against the reference sample
    # Report: top-10 overlap %, NDCG@10, Kendall's Tau
    ...
```

This proactively answers the judge question "how do you know your ranking is good?"

### 4.2 Update `submission_metadata.yaml`

Make sure these fields are filled:
```yaml
team_name: "Team Chanakya"
sandbox_url: "https://rrr-resume-ranker-recruiter-fronten.vercel.app"
backend_url: "https://your-render-url.onrender.com"
reproduce_command: "python rank.py --candidates ./candidates.jsonl --out ./submission.csv"
uses_gpu: false
runtime_minutes_estimate: 2
```

### 4.3 Add a `DEMO.md` to Both Repos

A single markdown file at the root of each repo that tells judges:
1. What the project does (2 sentences)
2. How to run it locally (copy-paste commands)
3. How to test the API (`curl` example)
4. Live demo link

Judges who can run your project in 2 minutes are happier judges.

### 4.4 Handle the Render Cold Start

Add a keep-alive ping in the frontend so the backend doesn't sleep during the demo:

```js
// In App.jsx useEffect on mount:
useEffect(() => {
  const ping = () => fetch(`${import.meta.env.VITE_API_URL}/health`).catch(() => {});
  ping(); // warm up on app load
  const interval = setInterval(ping, 9 * 60 * 1000); // ping every 9 min
  return () => clearInterval(interval);
}, []);
```

### 4.5 Add Skill Gap Analysis to the Candidate Modal

In `CandidateModal`, add a "Skill Gap" section showing which required JD skills the candidate is **missing**. This is something no basic ATS does and directly answers the hackathon requirement for "beyond keyword matching":

```jsx
const missingSkills = jdRequiredSkills.filter(
  jdSkill => !candidate.skills?.some(s => 
    s.name.toLowerCase().includes(jdSkill.toLowerCase())
  )
);

// Render:
{missingSkills.length > 0 && (
  <div className="mt-3">
    <p className="text-xs text-slate-400 font-mono uppercase mb-1">Skill Gaps</p>
    {missingSkills.map(s => (
      <span key={s} className="px-1.5 py-0.5 bg-red-900/30 text-red-400 text-[10px] rounded border border-red-800/40 mr-1">
        {s}
      </span>
    ))}
  </div>
)}
```

---

## Execution Timeline

| Day | Tasks |
|-----|-------|
| **Day 1** | Fix endorsement multiplier bug (1.2), fix reasoning string (1.3), add proficiency weighting (2.1) |
| **Day 2** | Add required skill coverage score (2.2), fix JD parser (2.4), add score mini-bars to cards (3.1) |
| **Day 3** | Add matched skill chips (3.2), export CSV button (3.4), skill gap analysis in modal (4.5) |
| **Day 4** | Add keep-alive ping (4.4), fill `submission_metadata.yaml` (4.2), write `DEMO.md` (4.3) |
| **Day 5** | Record demo video (1.4), update PPT to remove Faiss claim (1.1), final end-to-end test |

---

## What Will Make Judges Pick You First

| Judging Criterion | What Others Will Do | What You'll Do |
|---|---|---|
| **Ranking Quality** | Basic keyword or TF-IDF | Semantic embeddings + 5 signals + proficiency weighting + required skill coverage |
| **Explainability** | A score number | Score breakdown bar, reasoning string, skill gap analysis, ComplianceTray |
| **Innovation** | One ranking method | Talent Pools (Spotify-style watchlist), AES-encrypted private lists, local fallback ranker |
| **UI/UX** | Plain table | Resizable panels, candidate modal, score visualization, export to CSV |
| **Demo** | Slides | Live working product + video walkthrough + passphrase login wow moment |
| **Code Quality** | Monolith | Modular ranker/, typed FastAPI, Dockerfile, validate_submission.py |

---

*Generated from live codebase audit — Frontend commit `2941e3a` (Jun 8) and Backend commit `f6e9396` (Jun 7)*
