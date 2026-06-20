MAX_TEXT_LEN = 2000

def _truncate_candidate(c: dict) -> dict:
    profile = c.get("profile", {})
    for key in ["headline", "summary", "current_title", "current_company", "location"]:
        if isinstance(profile.get(key), str):
            profile[key] = profile[key][:MAX_TEXT_LEN]
    for skill in c.get("skills", []):
        if isinstance(skill.get("name"), str):
            skill["name"] = skill["name"][:100]
    for role in c.get("career_history", []):
        if isinstance(role.get("title"), str):
            role["title"] = role["title"][:200]
    return c

def sanitize_candidates(candidates: list) -> tuple[list, list]:
    """Returns (valid_candidates, skipped_ids)."""
    valid, skipped = [], []
    for idx, c in enumerate(candidates):
        if not isinstance(c, dict):
            skipped.append({'index': idx, 'reason': 'not_a_dict'})
            continue
        # Ensure required fields have safe defaults
        c.setdefault("skills", [])
        c.setdefault("work_experience", [])
        c.setdefault("redrob_signals", {})
        c.setdefault("profile", {})
        if not c.get("candidate_id"):
            skipped.append({'index': idx, 'reason': 'missing_candidate_id'})
            continue
        if not c.get("name"):
            c["name"] = c.get("candidate_id", "Unknown Candidate")
        valid.append(_truncate_candidate(c))
    return valid, skipped

def validate_candidate(c: dict) -> list:
    flags = []
    profile = c.get("profile") or {}
    try:
        if float(profile.get("years_of_experience") or 0) > 30:
            flags.append("Unusually high years of experience (>30)")
    except (TypeError, ValueError):
        pass
    if not c.get("skills"):
        flags.append("Missing skills section")
    if not c.get("career_history"):
        flags.append("Missing career history")
    return flags
