import type { SignalKey } from './observation';

export interface SignalBaselineStats {
  /** Robust center of this signal's personal history (e.g. median). */
  center: number;
  /** Robust spread (e.g. median absolute deviation), used to standardize residuals. */
  variability: number;
  /** Exponentially weighted moving average, tracks recent short-term trend. */
  ewma: number;
  /** Count of observations that have contributed to this signal's baseline so far. */
  sampleCount: number;
  /** ISO timestamp this signal's stats were last updated. */
  lastUpdated: string;
  /** 0..1 confidence derived from data sufficiency (sample count, recency, gaps). */
  confidence: number;
}

/** Per-person (n=1), per-signal baseline model. Absent key = no baseline yet for that signal. */
export type Baseline = Partial<Record<SignalKey, SignalBaselineStats>>;
