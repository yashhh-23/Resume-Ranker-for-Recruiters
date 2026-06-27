#!/usr/bin/env python
import argparse
import csv
import json
import time
import sys
from pathlib import Path

from ranker import parse_jd, rank_candidates
from ranker.validators import sanitize_candidates

CSV_HEADER = ["candidate_id", "rank", "score", "reasoning"]


def parse_candidates_stream(handle):
    for line in handle:
        line = line.strip()
        if line:
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def load_candidates(path: Path):
    if path.suffix.lower() == ".jsonl":
        with path.open("r", encoding="utf-8") as handle:
            return list(parse_candidates_stream(handle))
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload if isinstance(payload, list) else [payload]


def write_submission(rows, out_path: Path):
    with out_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_HEADER)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "candidate_id": row["candidate_id"],
                    "rank": row["rank"],
                    "score": f"{row['score']:.4f}",
                    "reasoning": row["reasoning"],
                }
            )


def parse_args():
    parser = argparse.ArgumentParser(
        description="Rank RRR candidates and write submission.csv"
    )
    parser.add_argument(
        "--candidates", required=True, help="Path to candidates JSON or JSONL"
    )
    parser.add_argument(
        "--jd", default="dataset/job_description.docx", help="Path to job_description.docx"
    )
    parser.add_argument("--out", default="submission.csv", help="Output CSV path")
    parser.add_argument("--top-n", type=int, default=100, help="Number of top candidates to output")
    return parser.parse_args()


def main():
    args = parse_args()
    started = time.perf_counter()

    candidates = load_candidates(Path(args.candidates))
    valid_candidates, skipped = sanitize_candidates(candidates)
    if skipped:
        print(f"Skipped {len(skipped)} invalid candidates.", file=sys.stderr)
    jd = parse_jd(args.jd)
    ranked = rank_candidates(valid_candidates, jd, limit=args.top_n)
    write_submission(ranked, Path(args.out))

    elapsed = time.perf_counter() - started
    top_ids = ", ".join(row["candidate_id"] for row in ranked[:5])
    print(f"Ranked {len(candidates)} candidates in {elapsed:.2f}s", file=sys.stderr)
    print(f"Wrote {args.out} with {len(ranked)} rows", file=sys.stderr)
    print(f"Top 5: {top_ids}", file=sys.stderr)

    test_results_dir = Path("test_results")
    test_results_dir.mkdir(exist_ok=True)
    json_out_path = test_results_dir / "ranked_results.json"
    metrics = {
        "execution_time_seconds": elapsed,
        "candidates_processed": len(candidates),
        "top_5": top_ids.split(", "),
        "results": ranked
    }
    with json_out_path.open("w", encoding="utf-8") as jf:
        json.dump(metrics, jf, indent=2)
    print(f"Wrote JSON results to {json_out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
