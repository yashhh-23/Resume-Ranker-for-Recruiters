def sanitize_candidates(candidates: list) -> tuple[list, list]:
    """Returns (valid_candidates, skipped_ids)."""
    valid, skipped = [], []
    for c in candidates:
        if not isinstance(c, dict):
            skipped.append(str(c))
            continue
        # Ensure required fields have safe defaults
        c.setdefault("skills", [])
        c.setdefault("work_experience", [])
        c.setdefault("redrob_signals", {})
        c.setdefault("profile", {})
        if not c.get("candidate_id"):
            skipped.append("(missing candidate_id)")
            continue
        valid.append(c)
    return valid, skipped
