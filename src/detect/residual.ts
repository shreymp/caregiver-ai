import { encodeSignalValue } from '@/baseline';
import type { SignalBaselineStats, SignalValue } from '@/types';

/**
 * Standardized residual (baseline-relative z-score-like distance). Returns
 * null when the signal can't be evaluated today: no observation, an
 * 'unknown' category, or no baseline yet (cold start) — callers must treat
 * null as "no data", never as a residual of 0.
 *
 * `varianceFloor` is a numerical-stability guard against dividing by an
 * exactly-zero MAD (e.g. a perfectly constant short history), not a clinical
 * parameter.
 */
export function computeResidual(
  rawValue: SignalValue | undefined,
  baselineStats: SignalBaselineStats | undefined,
  varianceFloor: number
): number | null {
  if (rawValue === undefined || baselineStats === undefined) return null;
  const encoded = encodeSignalValue(rawValue);
  if (encoded === null) return null;
  const denom = Math.max(baselineStats.variability, varianceFloor);
  return (encoded - baselineStats.center) / denom;
}
