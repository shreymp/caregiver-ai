import type { DeviationResult, ObservationRecord } from '@/types';

export interface SafetyOptions {
  /** Below this observation completeness, data is too sparse to trust a flag. Generic data-sufficiency gate, not a clinical threshold. */
  minCompleteness?: number;
  /** Below this DeviationResult confidence (baseline sufficiency x completeness), data is too weak to trust a flag. */
  minConfidence?: number;
  /** Cutoff distinguishing "signals look elevated" vs "signals look normal" for the note/signal conflict check — shares the detect layer's generic elevated-score default. */
  elevatedScoreThreshold?: number;
}

export const DEFAULT_SAFETY_OPTIONS: Required<SafetyOptions> = {
  minCompleteness: 0.3,
  minConfidence: 0.3,
  elevatedScoreThreshold: 1,
};

export type SafetyFlagReason = 'low-completeness' | 'low-confidence' | 'data-conflict';

export interface SafetyCheckResult {
  flagged: boolean;
  reasons: SafetyFlagReason[];
}

/**
 * Weak-data HITL path #1: if the day's observation is too sparse, or the
 * computed result rests on too little baseline data, don't trust a
 * deterministic tier call — flag for human review instead of guessing.
 */
export function checkWeakData(
  deviation: DeviationResult,
  observation: ObservationRecord,
  options: SafetyOptions = {}
): SafetyCheckResult {
  const { minCompleteness, minConfidence } = { ...DEFAULT_SAFETY_OPTIONS, ...options };
  const reasons: SafetyFlagReason[] = [];
  if (observation.completeness < minCompleteness) reasons.push('low-completeness');
  if (deviation.confidence < minConfidence) reasons.push('low-confidence');
  return { flagged: reasons.length > 0, reasons };
}
