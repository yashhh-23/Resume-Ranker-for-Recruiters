/**
 * scoreThresholds.js — Shared score tier boundary constants
 *
 * Used by CandidateCard (badge color) and any other component
 * that maps a raw 0.0–1.0 score to a visual tier.
 *
 * Tiers:
 *   HIGH   (≥ 0.75) → emerald  — strong fit
 *   MEDIUM (≥ 0.50) → amber    — moderate fit
 *   LOW    (< 0.50) → rose     — weak fit
 */
export const SCORE_TIERS = {
  HIGH:   0.75,  // emerald
  MEDIUM: 0.50,  // amber
  // below MEDIUM → rose
};
