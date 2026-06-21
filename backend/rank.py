#!/usr/bin/env python
import argparse
import csv
import json
import time
from pathlib import Path

from ranker import parse_jd_docx, rank_candidates


CSV_HEADER = ["candidate_id", "rank", "score", "reasoning"]


def load_candidates(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        if path.suffix.lower() == ".jsonl":
            return [json.loads(line) for line in handle if line.strip()]
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
    parser = argparse.ArgumentParser(description="Rank RRR candidates and write submission.csv")
    parser.add_argument("--candidates", required=True, help="Path to candidates JSON or JSONL")
    parser.add_argument("--jd", default="data/job_description.docx", help="Path to job_description.docx")
    parser.add_argument("--out", default="submission.csv", help="Output CSV path")
    parser.add_argument("--cache", default=".embedding_cache.pkl", help="Embedding cache path")
    parser.add_argument("--clear-cache", action="store_true", help="Delete embedding cache before run")
    return parser.parse_args()


def main():
    args = parse_args()
    if args.clear_cache and Path(args.cache).exists():
        Path(args.cache).unlink()
    started = time.perf_counter()

    candidates = load_candidates(Path(args.candidates))
    jd = parse_jd_docx(args.jd)
    ranked = rank_candidates(candidates, jd, cache_path=args.cache, limit=100)
    if len(ranked) < 100:
        print(f"WARNING: Only {len(ranked)} candidates ranked - submission requires top 100")
    write_submission(ranked, Path(args.out))

    elapsed = time.perf_counter() - started
    top_ids = ", ".join(row["candidate_id"] for row in ranked[:5])
    print(f"Ranked {len(candidates)} candidates in {elapsed:.2f}s")
    print(f"Wrote {args.out} with {len(ranked)} rows")
    print(f"Top 5: {top_ids}")


if __name__ == "__main__":
    main()
