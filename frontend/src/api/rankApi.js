const normalizeResults = (payload) => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates =
    payload.results || payload.ranked_results || payload.rankedCandidates || payload.ranked_candidates;

  return Array.isArray(candidates) ? candidates : [];
};

export const rankCandidates = async ({ jobDescription, candidates }) => {
  const baseUrl = import.meta.env.VITE_API_URL;

  if (!baseUrl) {
    throw new Error("VITE_API_URL is not set.");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/rank`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      job_description: jobDescription,
      candidates,
    }),
  });

  if (!response.ok) {
    throw new Error(`Rank API failed with status ${response.status}.`);
  }

  const data = await response.json();
  const results = normalizeResults(data);

  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("Rank API returned an empty result set.");
  }

  return results;
};
