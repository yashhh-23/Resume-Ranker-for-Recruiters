/**
 * jdUtils.js — Job Description skill extraction utilities
 * Extracts skill/technology keywords from raw JD text for
 * matching against candidate skills on cards and modals.
 */

// Common stopwords to exclude from skill extraction
const STOPWORDS = new Set([
  "the", "and", "or", "a", "an", "in", "on", "at", "to", "for", "of", "with",
  "is", "are", "be", "have", "has", "do", "does", "will", "would", "should",
  "can", "may", "must", "shall", "not", "we", "you", "our", "your", "their",
  "this", "that", "these", "those", "as", "by", "from", "up", "about", "into",
  "through", "during", "including", "until", "against", "among", "throughout",
  "experience", "strong", "knowledge", "understanding", "familiarity", "ability",
  "work", "working", "team", "teams", "ability", "skills", "skill", "role",
  "candidate", "candidates", "required", "preferred", "good", "well", "plus",
  "hands", "year", "years", "ideal", "excellent", "using", "use", "used",
  "across", "within", "seeking", "looking", "join", "build", "develop",
  "minimum", "least", "more", "than", "least", "responsibilities",
  "requirements", "qualifications", "bonus", "nice", "proficiency",
]);

/**
 * Extract a deduplicated list of probable skill tokens from JD text.
 * Returns tokens of 2+ chars that are not stopwords.
 */
export const extractJdSkills = (jdText) => {
  if (!jdText || typeof jdText !== "string") return [];

  // Normalize: lowercase, remove punctuation except hyphens/dots in tech names
  const normalized = jdText
    .replace(/[()[\]{}<>]/g, " ")
    .replace(/[,;:!?@#$%^&*+=|\\/"]/g, " ")
    .replace(/\n/g, " ");

  // Split on whitespace
  const tokens = normalized
    .split(/\s+/)
    .map((t) => t.replace(/^[-.]|[-.]$/g, "").trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t.toLowerCase()));

  // Deduplicate case-insensitively, preserving original casing of first occurrence
  const seen = new Map();
  for (const token of tokens) {
    const key = token.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, token);
    }
  }

  return Array.from(seen.values());
};

/**
 * Given a candidate skill name and the extracted JD skill tokens,
 * returns true if the skill matches any JD token.
 */
export const isSkillMatchedInJd = (skillName, jdSkillTokens) => {
  if (!skillName || !jdSkillTokens || jdSkillTokens.length === 0) return false;
  const lower = skillName.toLowerCase();
  return jdSkillTokens.some((token) => {
    const t = token.toLowerCase();
    return lower.includes(t) || t.includes(lower);
  });
};

/**
 * Given a list of required skills (strings) from the JD and a candidate's
 * skills array, returns the list of required skills that are MISSING.
 */
export const getMissingSkills = (jdRequiredSkills, candidateSkills) => {
  if (!jdRequiredSkills || jdRequiredSkills.length === 0) return [];
  const candidateSkillNames = (candidateSkills || []).map((s) =>
    (s.name || "").toLowerCase()
  );
  return jdRequiredSkills.filter((jdSkill) => {
    const jdLower = jdSkill.toLowerCase();
    return !candidateSkillNames.some(
      (cs) => cs.includes(jdLower) || jdLower.includes(cs)
    );
  });
};
