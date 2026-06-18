const normalizeResults = (payload) => {
  if (!payload) {
    return { results: [], meta: {} };
  }

  if (Array.isArray(payload)) {
    return { results: payload, meta: {} };
  }

  const candidates =
    payload.results || payload.ranked_results || payload.rankedCandidates || payload.ranked_candidates;

  return {
    results: Array.isArray(candidates) ? candidates : [],
    meta: {
      jd_parsed: payload.jd_parsed || null,
      processing_time_ms: payload.processing_time_ms || null,
      scored_candidates: payload.scored_candidates || null,
      total_candidates: payload.total_candidates || null,
      scoring_model: payload.scoring_model || null,
    },
  };
};

export const rankCandidates = async ({ jobDescription, candidates }) => {
  const baseUrl = import.meta.env.VITE_API_URL;

  if (!baseUrl) {
    throw new Error("Backend server is not configured. Check VITE_API_URL.");
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
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        const errorData = await response.json();
        const detail = errorData.detail || errorData.message || JSON.stringify(errorData);
        throw new Error(`Server error (${response.status}): ${detail}`);
      } catch (e) {
        // Fallback
      }
    }
    throw new Error(`Server returned ${response.status}: ${response.statusText || 'Error'}`);
  }

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error("Server returned non-JSON response.");
  }

  const data = await response.json();
  const { results, meta } = normalizeResults(data);

  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("Rank API returned an empty result set.");
  }

  return { results, meta };
};
