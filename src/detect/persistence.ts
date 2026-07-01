import type { DayScore } from './score';

/**
 * Counts consecutive trailing days (from the most recent observation
 * backward, through the chronologically sorted array) whose score exceeds
 * `elevatedScoreThreshold`. This is the alarm-fatigue defense input for the
 * tier layer (CLAUDE.md guardrail #6): a single-day blip yields
 * persistenceDays === 1 and does not, by itself, escalate a tier — only the
 * tier layer's rubric-sourced N-day rule decides what to do with this count.
 *
 * "Consecutive" here means consecutive *observation records* in the
 * provided history (the expected ~daily capture cadence), not
 * calendar-day-exact adjacency; a documented TRL3-scope simplification.
 */
export function countTrailingPersistence(
  dayScores: readonly DayScore[],
  elevatedScoreThreshold: number
): number {
  let count = 0;
  for (let i = dayScores.length - 1; i >= 0; i -= 1) {
    if ((dayScores[i] as DayScore).score > elevatedScoreThreshold) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}
