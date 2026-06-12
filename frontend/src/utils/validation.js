const REQUIRED_HEADER = ["candidate_id", "rank", "score", "reasoning"];
const CANDIDATE_ID_PATTERN = /^CAND_[0-9]{7}$/;

export const validateSubmission = (rows) => {
  const errors = [];
  const seenIds = new Set();
  const seenRanks = new Set();
  const byRank = [];

  if (rows.length !== 100) {
    errors.push(
      `After the header, there must be exactly 100 data rows; found ${rows.length}.`
    );
  }

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const cid = String(row.candidate_id || "").trim();
    const rankValue = row.rank;
    const scoreValue = row.score;

    if (!cid) {
      errors.push(`Row ${rowNum}: candidate_id is required.`);
    } else if (!CANDIDATE_ID_PATTERN.test(cid)) {
      errors.push(`Row ${rowNum}: candidate_id must be CAND_XXXXXXX (7 digits).`);
    } else if (seenIds.has(cid)) {
      errors.push(`Row ${rowNum}: duplicate candidate_id '${cid}'.`);
    } else {
      seenIds.add(cid);
    }

    const rank = Number.parseInt(rankValue, 10);
    if (!Number.isInteger(rank) || String(rank) !== String(rankValue)) {
      errors.push(`Row ${rowNum}: rank must be an integer (1-100).`);
    } else if (rank < 1 || rank > 100) {
      errors.push(`Row ${rowNum}: rank must be between 1 and 100.`);
    } else if (seenRanks.has(rank)) {
      errors.push(`Row ${rowNum}: duplicate rank ${rank}.`);
    } else {
      seenRanks.add(rank);
    }

    const score = Number(scoreValue);
    if (Number.isNaN(score)) {
      errors.push(`Row ${rowNum}: score must be a float.`);
    }

    if (!Number.isNaN(score) && Number.isInteger(rank) && cid) {
      byRank.push([rank, score, cid]);
    }
  });

  if (seenRanks.size) {
    const missing = [];
    for (let i = 1; i <= 100; i += 1) {
      if (!seenRanks.has(i)) {
        missing.push(i);
      }
    }
    if (missing.length) {
      errors.push(`Each rank 1-100 must appear exactly once; missing: ${missing.join(", ")}.`);
    }
  }

  byRank.sort((a, b) => a[0] - b[0]);

  for (let i = 0; i < byRank.length - 1; i += 1) {
    const [r1, s1] = byRank[i];
    const [r2, s2] = byRank[i + 1];
    if (s1 < s2) {
      errors.push(`score must be non-increasing by rank: rank ${r1} (${s1}) < rank ${r2} (${s2}).`);
    }
  }

  for (let i = 0; i < byRank.length - 1; i += 1) {
    const [r1, s1, c1] = byRank[i];
    const [r2, s2, c2] = byRank[i + 1];
    if (s1 === s2 && c1 > c2) {
      errors.push(
        `Equal scores at ranks ${r1} and ${r2}: tie-break requires candidate_id ascending (${c1} > ${c2}).`
      );
    }
  }

  return {
    errors,
    header: REQUIRED_HEADER,
    totalRows: rows.length,
    uniqueCandidates: seenIds.size,
    uniqueRanks: seenRanks.size,
  };
};
