import type { DeviationResult, ObservationRecord } from '@/types';
import { DEFAULT_SAFETY_OPTIONS, type SafetyCheckResult, type SafetyOptions } from './weakData';

/**
 * Generic concern-language keyword list — deliberately not clinical
 * vocabulary (no symptom-specific medical terms), just plain words a
 * caregiver would use to express worry in a free-text note. Used only to
 * detect a mismatch with structured signals, never to assert a diagnosis.
 */
const CONCERN_KEYWORDS: RegExp[] = [
  /\bpain\b/i,
  /\bsick\b/i,
  /\bunwell\b/i,
  /\bnot (himself|herself|themselves|right|okay|ok)\b/i,
  /\bworried\b/i,
  /\bworse\b/i,
  /\bscared\b/i,
  /\bconcern(ed|ing)?\b/i,
  /\bemergency\b/i,
  /\bhurt(ing)?\b/i,
];

/**
 * Weak-data HITL path #2: the caregiver's own free-text note expresses
 * concern while the structured signals for the same day look unremarkable
 * (or vice versa isn't checked here — a note-says-fine/signals-elevated case
 * is already visible via the tier itself). CLAUDE.md guardrail #5
 * ("augment, never gate") means we never suppress the caregiver's instinct —
 * this flags the conflict for a human to reconcile rather than silently
 * trusting the computed score over the caregiver's own words.
 */
export function checkNoteSignalConflict(
  observation: ObservationRecord,
  deviation: DeviationResult,
  options: SafetyOptions = {}
): SafetyCheckResult {
  const { elevatedScoreThreshold } = { ...DEFAULT_SAFETY_OPTIONS, ...options };
  const note = observation.note ?? '';
  const noteExpressesConcern = CONCERN_KEYWORDS.some((pattern) => pattern.test(note));
  const signalsLookUnremarkable = deviation.score <= elevatedScoreThreshold;
  const conflict = noteExpressesConcern && signalsLookUnremarkable;
  return { flagged: conflict, reasons: conflict ? ['data-conflict'] : [] };
}
