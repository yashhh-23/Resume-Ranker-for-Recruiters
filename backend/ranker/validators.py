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

REQUIRED_CANDIDATE_KEYS = {"candidate_id", "profile", "skills"}

def sanitize_candidates(candidates: list) -> tuple[list, list]:
    """Returns (valid_candidates, skipped_ids)."""
    valid, skipped = [], []
    for idx, c in enumerate(candidates):
        if not isinstance(c, dict):
            skipped.append({'index': idx, 'reason': 'not_a_dict'})
            continue
        if not any(k in c for k in REQUIRED_CANDIDATE_KEYS):
            skipped.append({'index': idx, 'reason': 'missing_required_keys'})
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
    skills = c.get("skills") or []
    career = c.get("career_history") or []

    # Existing checks
    try:
        if float(profile.get("years_of_experience") or 0) > 30:
            flags.append("Unusually high years of experience (>30)")
    except (TypeError, ValueError):
        pass
    if not skills:
        flags.append("Missing skills section")
    if not career:
        flags.append("Missing career history")

    # ── NEW CHECKS ────────────────────────────────────────────────────────

    # Duplicate skill names
    skill_names = [s.get("name", "").lower() for s in skills if s.get("name")]
    if len(skill_names) != len(set(skill_names)):
        flags.append("Duplicate skill entries detected")

    # Implausibly high endorsements (>500 on a single skill = suspicious)
    for s in skills:
        try:
            if int(s.get("endorsements" or 0) or 0) > 500:
                flags.append(f"Implausible endorsement count on skill: {s.get('name')}")
                break
        except (TypeError, ValueError):
            pass

    # Career history: future start_date
    from datetime import date
    today = date.today()
    for role in career:
        start = str(role.get("start_date") or "")
        if start:
            try:
                from datetime import datetime
                # Clean up if ISO format might end with Z or timezone offset
                clean_start = start
                if clean_start.endswith("Z"):
                    clean_start = clean_start[:-1]
                # Try handling date strings
                if len(clean_start) >= 10:
                    dt = datetime.fromisoformat(clean_start[:10]).date()
                    if dt > today:
                        flags.append(f"Future start_date in career history: {start}")
                        break
            except ValueError:
                pass

    # End date before start date in any role
    for role in career:
        start_str = str(role.get("start_date") or "")
        end_str = str(role.get("end_date") or "")
        if start_str and end_str and end_str.lower() != "present":
            try:
                from datetime import datetime
                clean_start = start_str[:-1] if start_str.endswith("Z") else start_str
                clean_end = end_str[:-1] if end_str.endswith("Z") else end_str
                s_date = datetime.fromisoformat(clean_start[:10]).date()
                e_date = datetime.fromisoformat(clean_end[:10]).date()
                if e_date < s_date:
                    flags.append("Career history has end_date before start_date")
                    break
            except ValueError:
                pass

    # Profile missing name/headline
    if not profile.get("name") and not profile.get("headline"):
        flags.append("Profile missing both name and headline")

    # Unrealistically high profile_completeness with missing data
    try:
        completeness = float(profile.get("profile_completeness_score") or 0)
        if completeness > 90 and not skills:
            flags.append("High completeness_score but missing skills (data inconsistency)")
    except (TypeError, ValueError):
        pass

    return flags
