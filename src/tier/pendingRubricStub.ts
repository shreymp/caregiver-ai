import type { DeviationResult, TierResult } from '@/types';

/**
 * PLACEHOLDER ONLY — this is not the real M5 tiering module.
 *
 * CLAUDE.md guardrail #8 forbids fabricating clinical thresholds, and
 * validation/labeling-rubric.md (human-authored: signal defs, deviation
 * thresholds, tier definitions) has not been supplied yet. Rather than
 * guess at real tiering rules, this always returns 'unsure' regardless of
 * the computed score, deferring every result to human review honestly.
 *
 * Replace this with the real M5 module (a deterministic score/confidence ->
 * tier mapping sourced from the rubric) the moment it's supplied — update
 * src/tier/index.ts's `computeTier` export, not this file's behavior. See
 * PROGRESS.md / DECISIONS.md for the blocking history.
 */
export function computePendingTier(deviation: DeviationResult): TierResult {
  return {
    tier: 'unsure',
    reason: `tiering rules are not yet configured (validation/labeling-rubric.md has not been supplied) — score ${deviation.score.toFixed(2)}, confidence ${deviation.confidence.toFixed(2)} awaiting human review`,
    overriddenBySafety: false,
  };
}
