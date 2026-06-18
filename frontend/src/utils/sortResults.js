import { SORT_KEYS } from "../constants/sortKeys";

/**
 * sortResults.js — Unified sort comparator for ranked result lists
 *
 * Single source of truth for all sort modes used in ResultsPanel.
 * Both the shortlist and talent-pool list import this to avoid duplication.
 *
 * @param {Array}  list   - Array of { candidate, result } items
 * @param {string} sortBy - Sort mode key
 * @returns {Array} New sorted array (does not mutate input)
 */
export const sortResults = (list, sortBy) => {
  const sorted = [...list];
  sorted.sort((a, b) => {
    if (sortBy === SORT_KEYS.SCORE) {
      const scoreA = a.result?.score ?? 0;
      const scoreB = b.result?.score ?? 0;
      const normA = scoreA > 1 ? scoreA / 100 : scoreA;
      const normB = scoreB > 1 ? scoreB / 100 : scoreB;
      return normB - normA;
    }
    if (sortBy === SORT_KEYS.ENGAGEMENT) {
      const sigA = a.result?.breakdown?.signal_modifier ?? a.result?.signal_modifier ?? 0;
      const sigB = b.result?.breakdown?.signal_modifier ?? b.result?.signal_modifier ?? 0;
      return sigB - sigA;
    }
    if (sortBy === SORT_KEYS.EXPERIENCE) {
      const expA = a.candidate?.profile?.years_of_experience || 0;
      const expB = b.candidate?.profile?.years_of_experience || 0;
      return expB - expA;
    }
    if (sortBy === SORT_KEYS.NOTICE) {
      const noticeA = a.candidate?.redrob_signals?.notice_period_days ?? 999;
      const noticeB = b.candidate?.redrob_signals?.notice_period_days ?? 999;
      return noticeA - noticeB;
    }
    if (sortBy === SORT_KEYS.COMPLETENESS) {
      const compA = a.candidate?.redrob_signals?.profile_completeness_score || 0;
      const compB = b.candidate?.redrob_signals?.profile_completeness_score || 0;
      return compB - compA;
    }
    if (sortBy === SORT_KEYS.SKILLS) {
      const skillsA = a.candidate?.skills?.length || 0;
      const skillsB = b.candidate?.skills?.length || 0;
      return skillsB - skillsA;
    }
    // Default: sort by rank (ascending)
    const rankA = a.result?.rank === "-" ? 999 : Number(a.result?.rank || 999);
    const rankB = b.result?.rank === "-" ? 999 : Number(b.result?.rank || 999);
    return rankA - rankB;
  });
  return sorted;
};
