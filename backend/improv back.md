🔴 4 Critical Issues Still Remaining
1 — score_career_fit still saturates (root cause not fixed)
MAX_CAREER_SCORE was changed from 3.0 → 5.0 but the raw sum approach remains. A candidate with 6 roles still accumulates raw_score > 5.0 and clamps to 1.0. The fix is normalisation by role count, not adjusting the constant.

2 — parse_jd() still silently fails for raw text strings / .md / .pdf
The new parse_jd() only handles .txt and .docx. If a path doesn't exist or has another extension, it falls through to parse_jd_docx() which returns all empty defaults. The fix: treat any unrecognised input as a raw JD text string.

3 — test_api.py asserts status code 422 but main.py raises 400
python
assert response.status_code == 422  # ← WRONG, main.py raises 400
Pydantic accepts "" as valid, the manual HTTPException fires a 400. This test will fail in CI.

4 — sys.modules["torchvision"] = None in embedding_utils.py is a global poison
This hack kills any future import of torchvision in the same process. Since torchvision isn't in requirements.txt it will never be installed anyway — the line should simply be removed.

🟢 3 Polish Items Remaining
test_ranker.py — no tests for scorer functions (score_career_fit, score_education, score_availability, rank_candidates) — only tests sanitize_candidates and parse_jd_text

test_api.py — missing tests for GET /, GET /weights, and /health field validation

rank.py — all print() warnings still go to stdout instead of stderr, corrupting pipeline output