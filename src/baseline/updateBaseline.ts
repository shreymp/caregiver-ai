import {
  SIGNAL_KEYS,
  type Baseline,
  type ObservationRecord,
  type SignalBaselineStats,
  type SignalKey,
} from '@/types';
import { encodeSignalValue } from './encode';
import { ewma, median, medianAbsoluteDeviation } from './robustStats';

export interface UpdateBaselineOptions {
  /** Max most-recent samples used for center/variability (bounded rolling window). */
  windowSize?: number;
  /** EWMA smoothing factor in (0,1]; higher weights recent values more. */
  ewmaAlpha?: number;
  /** Sample count at which confidence reaches 1.0 — a data-sufficiency ramp, not a clinical threshold. */
  fullConfidenceSampleCount?: number;
}

const DEFAULT_OPTIONS: Required<UpdateBaselineOptions> = {
  windowSize: 30,
  ewmaAlpha: 0.3,
  fullConfidenceSampleCount: 14,
};

export interface SignalHistoryPoint {
  timestamp: string;
  value: number;
}

/**
 * Updates a single signal's baseline from its chronological (ascending),
 * already-encoded history. Missing days are naturally tolerated: a day with
 * no observation for this signal simply never appears in `history` — no gap
 * penalty is applied.
 */
export function updateSignalBaseline(
  history: readonly SignalHistoryPoint[],
  now: string,
  options: UpdateBaselineOptions = {}
): SignalBaselineStats | undefined {
  if (history.length === 0) return undefined;

  const { windowSize, ewmaAlpha, fullConfidenceSampleCount } = { ...DEFAULT_OPTIONS, ...options };
  const windowed = history.slice(-windowSize);
  const values = windowed.map((p) => p.value);

  const center = median(values);
  const variability = medianAbsoluteDeviation(values, center);
  const ewmaValue = ewma(values, ewmaAlpha);
  const confidence = Math.min(1, windowed.length / fullConfidenceSampleCount);

  return {
    center,
    variability,
    ewma: ewmaValue,
    sampleCount: windowed.length,
    lastUpdated: now,
    confidence,
  };
}

/** Extracts one signal's chronological, encodable-only history from the full observation history. */
export function extractSignalHistory(
  observations: readonly ObservationRecord[],
  signal: SignalKey
): SignalHistoryPoint[] {
  const points: SignalHistoryPoint[] = [];
  for (const obs of observations) {
    const raw = obs.signals[signal];
    if (raw === undefined) continue;
    const encoded = encodeSignalValue(raw);
    if (encoded === null) continue;
    points.push({ timestamp: obs.timestamp, value: encoded });
  }
  return points;
}

/**
 * Recomputes the full personal Baseline (all signals) from the complete
 * observation history. Call after every new observation is stored —
 * "online-updatable" via a bounded rolling window rather than O(1) streaming
 * update, which is cheap enough at this data scale and keeps the math simple
 * and auditable. Cold-start signals with zero data are simply absent from
 * the result (per the Baseline type: Partial<Record<SignalKey, ...>>).
 */
export function updateBaseline(
  observations: readonly ObservationRecord[],
  now: string = new Date().toISOString(),
  options: UpdateBaselineOptions = {}
): Baseline {
  const sorted = [...observations].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const baseline: Baseline = {};
  for (const signal of SIGNAL_KEYS) {
    const history = extractSignalHistory(sorted, signal);
    const stats = updateSignalBaseline(history, now, options);
    if (stats) baseline[signal] = stats;
  }
  return baseline;
}
