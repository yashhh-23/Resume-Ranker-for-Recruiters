#!/usr/bin/env python
import argparse
import csv
import re
from pathlib import Path


REQUIRED_HEADER = ["candidate_id", "rank", "score", "reasoning"]
CANDIDATE_ID_PATTERN = re.compile(r"^CAND_[0-9]{7}$")
EXPECTED_ROWS = 100


def validate_submission(path: Path):
    errors = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        header = next(reader, None)
        if header != REQUIRED_HEADER:
            errors.append(f"Header must be exactly {','.join(REQUIRED_HEADER)}")
            return errors
        rows = [row for row in reader if any(cell.strip() for cell in row)]

    if len(rows) != EXPECTED_ROWS:
        errors.append(f"Expected {EXPECTED_ROWS} data rows; found {len(rows)}")

    seen_ids = set()
    seen_ranks = set()
    ranked_scores = []

    for index, cells in enumerate(rows, start=2):
        if len(cells) != len(REQUIRED_HEADER):
            errors.append(f"Row {index}: expected {len(REQUIRED_HEADER)} columns")
            continue
        candidate_id, rank_text, score_text, _ = cells
        if not CANDIDATE_ID_PATTERN.match(candidate_id):
            errors.append(f"Row {index}: invalid candidate_id {candidate_id}")
        if candidate_id in seen_ids:
            errors.append(f"Row {index}: duplicate candidate_id {candidate_id}")
        seen_ids.add(candidate_id)

        try:
            rank = int(rank_text)
        except ValueError:
            errors.append(f"Row {index}: rank must be an integer")
            continue
        if rank < 1 or rank > EXPECTED_ROWS:
            errors.append(f"Row {index}: rank must be 1-{EXPECTED_ROWS}")
        if rank in seen_ranks:
            errors.append(f"Row {index}: duplicate rank {rank}")
        seen_ranks.add(rank)

        try:
            score = float(score_text)
        except ValueError:
            errors.append(f"Row {index}: score must be a float")
            continue
        if score < 0 or score > 1:
            errors.append(f"Row {index}: score must be 0.0-1.0")
        if "." in score_text and len(score_text.split(".", 1)[1]) != 4:
            errors.append(f"Row {index}: score must have 4 decimal places")
        ranked_scores.append((rank, score, candidate_id))

    missing = sorted(set(range(1, EXPECTED_ROWS + 1)) - seen_ranks)
    if missing:
        errors.append(f"Missing ranks: {missing}")

    ranked_scores.sort()
    for left, right in zip(ranked_scores, ranked_scores[1:]):
        if left[1] < right[1]:
            errors.append(f"Score must be non-increasing: rank {left[0]} < rank {right[0]}")
        if left[1] == right[1] and left[2] > right[2]:
            errors.append(f"Tie-break requires candidate_id ascending at ranks {left[0]} and {right[0]}")

    return errors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("submission", nargs="?", default="submission.csv")
    args = parser.parse_args()

    errors = validate_submission(Path(args.submission))
    if errors:
        print(f"Validation failed ({len(errors)} issue(s)):")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)
    print("Submission is valid.")


if __name__ == "__main__":
    main()
