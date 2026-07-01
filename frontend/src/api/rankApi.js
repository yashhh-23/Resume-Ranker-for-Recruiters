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

  // Inject strict anti-caching HTTP headers into the ranking POST request
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/rank`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    body: JSON.stringify({
      job_description: jobDescription,
      candidates,
    }),
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const errorData = await response.json().catch(() => null);
      if (errorData) {
        const detail = errorData.detail || errorData.message || JSON.stringify(errorData);
        throw new Error(`Server error (${response.status}): ${detail}`);
      }
    }
    throw new Error(`Server returned ${response.status}: ${response.statusText || 'Error'}`);
  }

  const responseData = await response.json();
  console.log("[DIAGNOSTIC] Raw payload received from backend response:", responseData);
  if (responseData.status !== "success" || !responseData.filePath) {
    throw new Error("Rank API returned unexpected response structure.");
  }

  // Force the client-side download utility to append a dynamic query cache-buster string to the retrieval hook URL
  const fetchUrl = `${baseUrl.replace(/\/$/, "")}/download?file=${responseData.filePath}&t=${new Date().getTime()}`;

  const downloadResponse = await fetch(fetchUrl, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });

  if (!downloadResponse.ok) {
    throw new Error(`Failed to download ranked results from ${fetchUrl}`);
  }

  const csvText = await downloadResponse.text();

  // Parse CSV format: candidate_id,rank,score,reasoning
  const lines = csvText.split(/\r?\n/);
  const parsedResults = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const comma1 = line.indexOf(",");
    if (comma1 === -1) continue;
    const comma2 = line.indexOf(",", comma1 + 1);
    if (comma2 === -1) continue;
    const comma3 = line.indexOf(",", comma2 + 1);
    if (comma3 === -1) continue;

    const candidate_id = line.substring(0, comma1).trim();
    const rank = Number(line.substring(comma1 + 1, comma2).trim());
    const score = Number(line.substring(comma2 + 1, comma3).trim());
    let reasoning = line.substring(comma3 + 1).trim();

    if (reasoning.startsWith('"') && reasoning.endsWith('"')) {
      reasoning = reasoning.substring(1, reasoning.length - 1);
    }
    reasoning = reasoning.replace(/""/g, '"');

    parsedResults.push({
      candidate_id,
      rank,
      score,
      reasoning
    });
  }

  const { results, meta } = normalizeResults(parsedResults);
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
