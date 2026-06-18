from datetime import date, datetime

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
            skipped.append({"index": idx, "candidate_id": None, "reason": "not_a_dict"})
            continue
        if not any(k in c for k in REQUIRED_CANDIDATE_KEYS):
            skipped.append(
                {
                    "index": idx,
                    "candidate_id": c.get("candidate_id", f"unknown-{idx}"),
                    "reason": "missing_required_keys",
                }
            )
            continue
        # Ensure required fields have safe defaults
        c.setdefault("skills", [])
        c.setdefault("work_experience", [])
        c.setdefault("redrob_signals", {})
        c.setdefault("profile", {})
        if not c.get("candidate_id"):
            skipped.append(
                {"index": idx, "candidate_id": None, "reason": "missing_candidate_id"}
            )
            continue
        if not c.get("name"):
            c["name"] = c.get("candidate_id", "Unknown Candidate")
        valid.append(_truncate_candidate(c))
    return valid, skipped


def validate_candidate(c: dict) -> tuple[list, list | None]:
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
    else:
        try:
            declared_years = float(profile.get("years_of_experience") or 0)
            if declared_years > 0:
                total_months = 0
                for role in career:
                    start_str = str(role.get("start_date") or "")
                    end_str = str(role.get("end_date") or "")
                    if not start_str:
                        continue
                    try:
                        from dateutil.parser import parse as parse_date
                        start_d = parse_date(start_str).date()
                        if end_str and end_str.lower() != "present":
                            end_d = parse_date(end_str).date()
                        else:
                            end_d = date.today()
                        total_months += max(
                            0,
                            (end_d.year - start_d.year) * 12
                            + (end_d.month - start_d.month),
                        )
                    except (ValueError, OverflowError, TypeError):
                        pass
                computed_years = total_months / 12
                # Flag if declared years exceed computed by more than 5 years
                if declared_years > computed_years + 5:
                    flags.append(
                        f"Declared experience ({declared_years:.0f}y) "
                        f"inconsistent with career history ({computed_years:.1f}y computed)"
                    )
        except Exception:
            pass

    # ── NEW CHECKS ────────────────────────────────────────────────────────

    # Duplicate skill names and deduplication
    seen_skills = set()
    deduped_skills = []
    skills_changed = False
    for sk in c.get("skills") or []:
        name = str(sk.get("name", "")).strip().lower()
        if name and name not in seen_skills:
            seen_skills.add(name)
            deduped_skills.append(sk)
        elif name in seen_skills:
            skills_changed = True
            flags.append(f"Duplicate skill: {sk.get('name')}")

    # Implausibly high endorsements (>500 on a single skill = suspicious)
    for s in skills:
        try:
            if int(s.get("endorsements", 0) or 0) > 500:
                flags.append(f"Implausible endorsement count on skill: {s.get('name')}")
                break
        except (TypeError, ValueError):
            pass

    # Career history: future start_date
    today = date.today()
    for role in career:
        start = str(role.get("start_date") or "")
        if start:
            try:
                from dateutil.parser import parse as parse_date
                dt = parse_date(start).date()
                if dt > today:
                    flags.append(f"Future start_date in career history: {start}")
                    break
            except (ValueError, OverflowError, TypeError):
                pass

    # End date before start date in any role
    for role in career:
        start_str = str(role.get("start_date") or "")
        end_str = str(role.get("end_date") or "")
        if start_str and end_str and end_str.lower() != "present":
            try:
                from dateutil.parser import parse as parse_date
                s_date = parse_date(start_str).date()
                e_date = parse_date(end_str).date()
                if e_date < s_date:
                    flags.append("Career history has end_date before start_date")
                    break
            except (ValueError, OverflowError, TypeError):
                pass

    # Profile missing name/headline
    if not profile.get("name") and not profile.get("headline"):
        flags.append("Profile missing both name and headline")

    # Unrealistically high profile_completeness with missing data
    try:
        completeness = float(profile.get("profile_completeness_score") or 0)
        if completeness > 90 and not skills:
            flags.append(
                "High completeness_score but missing skills (data inconsistency)"
            )
    except (TypeError, ValueError):
        pass

    return flags, (deduped_skills if skills_changed else None)
