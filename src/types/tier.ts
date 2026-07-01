/**
 * Action tier. 'unsure' is reserved for the safety layer (src/safety) — it is
 * never chosen by the deterministic tiering rules in src/tier directly from a
 * score, only assigned as a safety override. See CLAUDE.md guardrails #1, #2, #6.
 */
export type Tier = 'watch' | 'call' | 'escalate' | 'unsure';

export interface TierResult {
  tier: Tier;
  /** Short deterministic justification (e.g. "score 2.1 sustained 3 days"). Never LLM-authored. */
  reason: string;
  /** True if the safety layer overrode a computed tier with 'unsure'. */
  overriddenBySafety: boolean;
}
