import { test, expect } from "vitest";
import { sortResults } from "../src/utils/sortResults";
import { SORT_KEYS } from "../src/constants/sortKeys";

const makeItem = ({ rank = null, score = null, exp = null, signals = null, notice = null, completeness = null, skillsCount = 0 }) => {
  const skills = Array.from({ length: skillsCount }).map((_, idx) => ({ name: `Skill ${idx}` }));
  return {
    result: { rank, score, breakdown: { signal_modifier: signals } },
    candidate: {
      profile: { years_of_experience: exp },
      skills,
      redrob_signals: {
        notice_period_days: notice,
        profile_completeness_score: completeness,
      },
    },
  };
};

test("sorts by rank ascending by default or when specified", () => {
  const list = [
    makeItem({ rank: 3 }),
    makeItem({ rank: 1 }),
    makeItem({ rank: 2 }),
  ];
  const sorted = sortResults(list, SORT_KEYS.RANK);
  expect(sorted.map(i => i.result.rank)).toEqual([1, 2, 3]);
});

test("sorts by fit index score descending", () => {
  const list = [
    makeItem({ score: 0.45 }),
    makeItem({ score: 0.92 }),
    makeItem({ score: 0.65 }),
  ];
  const sorted = sortResults(list, SORT_KEYS.SCORE);
  expect(sorted.map(i => i.result.score)).toEqual([0.92, 0.65, 0.45]);
});

test("sorts by engagement signals descending", () => {
  const list = [
    makeItem({ signals: 0.3 }),
    makeItem({ signals: 0.9 }),
    makeItem({ signals: 0.6 }),
  ];
  const sorted = sortResults(list, SORT_KEYS.ENGAGEMENT);
  expect(sorted.map(i => i.result.breakdown.signal_modifier)).toEqual([0.9, 0.6, 0.3]);
});

test("sorts by notice period ascending (shorter first)", () => {
  const list = [
    makeItem({ notice: 60 }),
    makeItem({ notice: 10 }),
    makeItem({ notice: 30 }),
  ];
  const sorted = sortResults(list, SORT_KEYS.NOTICE);
  expect(sorted.map(i => i.candidate.redrob_signals.notice_period_days)).toEqual([10, 30, 60]);
});

test("handles string notice period without crash", () => {
  const list = [makeItem({ notice: "30" }), makeItem({ notice: 15 })];
  expect(() => sortResults(list, SORT_KEYS.NOTICE)).not.toThrow();
});

test("sorts by profile completeness score descending", () => {
  const list = [
    makeItem({ completeness: 50 }),
    makeItem({ completeness: 95 }),
    makeItem({ completeness: 80 }),
  ];
  const sorted = sortResults(list, SORT_KEYS.COMPLETENESS);
  expect(sorted.map(i => i.candidate.redrob_signals.profile_completeness_score)).toEqual([95, 80, 50]);
});

test("sorts by skills count descending", () => {
  const list = [
    makeItem({ skillsCount: 2 }),
    makeItem({ skillsCount: 8 }),
    makeItem({ skillsCount: 5 }),
  ];
  const sorted = sortResults(list, SORT_KEYS.SKILLS);
  expect(sorted.map(i => i.candidate.skills.length)).toEqual([8, 5, 2]);
});

test("handles null/undefined gracefully", () => {
  const list = [makeItem({}), makeItem({ rank: 1, score: 0.5, exp: 5, signals: 0.5, notice: 30, completeness: 80, skillsCount: 3 })];
  expect(() => sortResults(list, SORT_KEYS.RANK)).not.toThrow();
  expect(() => sortResults(list, SORT_KEYS.SCORE)).not.toThrow();
  expect(() => sortResults(list, SORT_KEYS.ENGAGEMENT)).not.toThrow();
  expect(() => sortResults(list, SORT_KEYS.NOTICE)).not.toThrow();
  expect(() => sortResults(list, SORT_KEYS.COMPLETENESS)).not.toThrow();
  expect(() => sortResults(list, SORT_KEYS.SKILLS)).not.toThrow();
});
