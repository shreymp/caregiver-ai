import type { DeviationResult, ObservationRecord, TierResult } from '@/types';
import { checkNoteSignalConflict } from './noteConflict';
import { checkWeakData, type SafetyOptions } from './weakData';

export interface SafetyLayerInput {
  observation: ObservationRecord;
  deviation: DeviationResult;
  tier: TierResult;
}

/**
 * Runs both HITL flag paths (weak data, note/signal conflict) and, if
 * either trips, overrides the computed tier with 'unsure' — never silently
 * escalates or de-escalates on its own judgment (CLAUDE.md guardrail #5:
 * augment, never gate). If neither trips, the tier passes through unchanged.
 */
export function applySafetyLayer(input: SafetyLayerInput, options: SafetyOptions = {}): TierResult {
  const weakData = checkWeakData(input.deviation, input.observation, options);
  const conflict = checkNoteSignalConflict(input.observation, input.deviation, options);
  const reasons = [...weakData.reasons, ...conflict.reasons];

  if (reasons.length === 0) return input.tier;

  return {
    tier: 'unsure',
    reason: `flagged for human review (${reasons.join(', ')})`,
    overriddenBySafety: true,
  };
}
