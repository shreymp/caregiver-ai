import type { Baseline, DeviationResult, ObservationRecord } from '@/types';
import { detectChangepoint, type CusumOptions } from './changepoint';
import { countTrailingPersistence } from './persistence';
import { scoreObservation } from './score';

export interface DetectOptions {
  /** Generic statistical "elevated today" marker used only for persistence-day counting (not a clinical action threshold — that mapping lives in src/tier, sourced from the labeling rubric). */
  elevatedScoreThreshold?: number;
  /** Numerical-stability floor for baseline variability in residual calculation. */
  varianceFloor?: number;
  cusum?: CusumOptions;
}

const DEFAULT_OPTIONS: Required<Omit<DetectOptions, 'cusum'>> & { cusum: CusumOptions } = {
  elevatedScoreThreshold: 1,
  varianceFloor: 0.1,
  cusum: {},
};

/**
 * Computes the DeviationResult for the most recent observation in `history`,
 * given the current personal Baseline. Pure and deterministic: identical
 * inputs always produce identical output (CLAUDE.md guardrail #2). Never
 * imports from parse/ or reason/ (enforced by eslint.config.js) — detection
 * never depends on the LLM.
 */
export function computeDeviation(
  history: readonly ObservationRecord[],
  baseline: Baseline,
  options: DetectOptions = {},
  now: string = new Date().toISOString()
): DeviationResult {
  const { elevatedScoreThreshold, varianceFloor, cusum } = { ...DEFAULT_OPTIONS, ...options };

  if (history.length === 0) {
    return { timestamp: now, score: 0, perSignal: [], confidence: 0, persistenceDays: 0, changepointDetected: false };
  }

  const sorted = [...history].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const dayScores = sorted.map((obs) => scoreObservation(obs, baseline, varianceFloor));
  const latest = dayScores[dayScores.length - 1];
  if (!latest) {
    return { timestamp: now, score: 0, perSignal: [], confidence: 0, persistenceDays: 0, changepointDetected: false };
  }

  const persistenceDays = countTrailingPersistence(dayScores, elevatedScoreThreshold);
  const { changepointDetected } = detectChangepoint(
    dayScores.map((d) => d.score),
    cusum
  );

  const contributingConfidences = latest.perSignal.map((p) => baseline[p.signal]?.confidence ?? 0);
  const meanBaselineConfidence =
    contributingConfidences.length > 0
      ? contributingConfidences.reduce((a, b) => a + b, 0) / contributingConfidences.length
      : 0;
  const confidence = latest.completeness * meanBaselineConfidence;

  return {
    timestamp: latest.timestamp,
    score: latest.score,
    perSignal: latest.perSignal,
    confidence,
    persistenceDays,
    changepointDetected,
  };
}
