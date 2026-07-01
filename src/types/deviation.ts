import type { SignalKey, SignalValue } from './observation';

export interface SignalContribution {
  signal: SignalKey;
  observedValue: SignalValue;
  /** Standardized residual (e.g. z-score-like distance from this signal's baseline). */
  residual: number;
  /** This signal's share (0..1) of the overall multivariate score. */
  contribution: number;
}

export interface DeviationResult {
  /** ISO timestamp of the observation this result was computed for. */
  timestamp: string;
  /** Overall multivariate deviation score for this observation. */
  score: number;
  /** Per-signal breakdown, sorted by contribution descending, for explainability. */
  perSignal: SignalContribution[];
  /** 0..1 confidence in this result, derived from baseline data sufficiency + completeness. */
  confidence: number;
  /** Consecutive days (including this one) the deviation has held above threshold. */
  persistenceDays: number;
  /** Whether a changepoint (shift in the underlying signal level) was detected. */
  changepointDetected: boolean;
}
