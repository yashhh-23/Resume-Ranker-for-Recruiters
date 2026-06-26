import { test, expect } from "vitest";
import { sortResults } from "../src/utils/sortResults";
import { SORT_KEYS } from "../src/constants/sortKeys";

const makeItem = (rank, score, exp, signals) => ({
  result: { rank, score, breakdown: { signal_modifier: signals } },
  candidate: { profile: { years_of_experience: exp }, skills: [], redrob_signals: {} },
});

test("sorts by rank ascending by default or when specified", () => {
  const list = [makeItem(3, 0.5, 5, 0.5), makeItem(1, 0.8, 3, 0.8), makeItem(2, 0.3, 7, 0.3)];
  const sorted = sortResults(list, SORT_KEYS.RANK);
  expect(sorted.map(i => i.result.rank)).toEqual([1, 2, 3]);
});

test("sorts by fit index score descending", () => {
  const list = [makeItem(1, 0.45, 5, 0.3), makeItem(2, 0.92, 3, 0.9), makeItem(3, 0.65, 7, 0.6)];
  const sorted = sortResults(list, SORT_KEYS.SCORE);
  expect(sorted.map(i => i.result.score)).toEqual([0.92, 0.65, 0.45]);
});

test("sorts by engagement signals descending", () => {
  const list = [makeItem(1, 0.5, 5, 0.3), makeItem(2, 0.8, 3, 0.9), makeItem(3, 0.6, 7, 0.6)];
  const sorted = sortResults(list, SORT_KEYS.ENGAGEMENT);
  expect(sorted[0].result.breakdown.signal_modifier).toBe(0.9);
  expect(sorted[1].result.breakdown.signal_modifier).toBe(0.6);
  expect(sorted[2].result.breakdown.signal_modifier).toBe(0.3);
});

test("handles null/undefined gracefully", () => {
  const list = [makeItem(null, null, null, undefined), makeItem(1, 0.5, 5, 0.5)];
  expect(() => sortResults(list, SORT_KEYS.RANK)).not.toThrow();
  expect(() => sortResults(list, SORT_KEYS.SCORE)).not.toThrow();
  expect(() => sortResults(list, SORT_KEYS.ENGAGEMENT)).not.toThrow();
});
