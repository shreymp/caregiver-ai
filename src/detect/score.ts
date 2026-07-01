import {
  SIGNAL_KEYS,
  type Baseline,
  type ObservationRecord,
  type SignalContribution,
  type SignalKey,
  type SignalValue,
} from '@/types';
import { computeResidual } from './residual';

export interface DayScore {
  timestamp: string;
  /** Root-mean-square of standardized residuals across signals with data today (diagonal-covariance multivariate departure — see DECISIONS.md). */
  score: number;
  perSignal: SignalContribution[];
  completeness: number;
}

/**
 * Scores a single observation against the current baseline. The multivariate
 * score is the RMS of per-signal standardized residuals — equivalent to a
 * Mahalanobis distance under a diagonal covariance assumption (per-signal
 * variance only, no cross-signal correlation term). This is a deliberate
 * simplification: estimating a full covariance matrix is not statistically
 * stable from a single person's short history. See DECISIONS.md.
 */
export function scoreObservation(
  obs: ObservationRecord,
  baseline: Baseline,
  varianceFloor: number
): DayScore {
  const evaluated: { signal: SignalKey; observedValue: SignalValue; residual: number }[] = [];

  for (const signal of SIGNAL_KEYS) {
    const rawValue = obs.signals[signal];
    if (rawValue === undefined) continue;
    const residual = computeResidual(rawValue, baseline[signal], varianceFloor);
    if (residual === null) continue;
    evaluated.push({ signal, observedValue: rawValue, residual });
  }

  const sumSquares = evaluated.reduce((acc, c) => acc + c.residual ** 2, 0);
  const score = evaluated.length > 0 ? Math.sqrt(sumSquares / evaluated.length) : 0;

  const perSignal: SignalContribution[] = evaluated
    .map((c) => ({
      signal: c.signal,
      observedValue: c.observedValue,
      residual: c.residual,
      contribution: sumSquares > 0 ? c.residual ** 2 / sumSquares : 0,
    }))
    .sort((a, b) => b.contribution - a.contribution);

  return { timestamp: obs.timestamp, score, perSignal, completeness: obs.completeness };
}
