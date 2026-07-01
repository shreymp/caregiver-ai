import {
  SIGNAL_KEYS,
  validateObservation,
  type CaptureSource,
  type SignalKey,
  type SignalValue,
  type ValidationResult,
} from '@/types';

export interface TypedCaptureInput {
  signals: Partial<Record<SignalKey, SignalValue>>;
  note?: string;
}

/**
 * Builds a schema-validated ObservationRecord directly from structured form
 * input — no LLM involved. This is the guaranteed capture path (CLAUDE.md
 * M9 "typed first") and doubles as the WebGPU-absent fallback path required
 * by M7: it works identically with or without a model loaded. Completeness
 * is computed from how many known signals were actually filled in, never
 * asked of a model (guardrail #1).
 */
export function buildTypedObservation(
  input: TypedCaptureInput,
  source: CaptureSource = 'typed',
  now: string = new Date().toISOString()
): ValidationResult {
  const present = SIGNAL_KEYS.filter((key) => input.signals[key] !== undefined).length;
  const completeness = present / SIGNAL_KEYS.length;
  return validateObservation({
    timestamp: now,
    signals: input.signals,
    note: input.note,
    completeness,
    source,
  });
}
