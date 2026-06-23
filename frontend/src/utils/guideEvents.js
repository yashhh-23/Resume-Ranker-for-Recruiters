/**
 * Guide Event Bus
 * Lightweight custom-event helper for the interactive guide tour.
 * Components fire these; GuideTour listens and responds.
 *
 * Usage:  dispatchGuideEvent("candidate-modal-open")
 * GuideTour listens:  rrr:guide:candidate-modal-open
 */
export const dispatchGuideEvent = (name) =>
  document.dispatchEvent(new CustomEvent(`rrr:guide:${name}`));
