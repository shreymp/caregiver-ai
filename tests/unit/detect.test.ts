import { describe, expect, it } from 'vitest';
import { computeResidual } from '@/detect/residual';
import { scoreObservation } from '@/detect/score';
import { detectChangepoint } from '@/detect/changepoint';
import { countTrailingPersistence, type DayScore } from '@/detect';
import { computeDeviation } from '@/detect/computeDeviation';
import { updateBaseline } from '@/baseline';
import type { Baseline, ObservationRecord, SignalBaselineStats } from '@/types';

function stats(overrides: Partial<SignalBaselineStats> = {}): SignalBaselineStats {
  return {
    center: 7,
    variability: 1,
    ewma: 7,
    sampleCount: 20,
    lastUpdated: '2026-06-01T00:00:00.000Z',
    confidence: 1,
    ...overrides,
  };
}

describe('computeResidual', () => {
  it('returns null when the signal was not observed today', () => {
    expect(computeResidual(undefined, stats(), 0.1)).toBeNull();
  });

  it('returns null when there is no baseline yet (cold start)', () => {
    expect(computeResidual(7, undefined, 0.1)).toBeNull();
  });

  it("returns null for an 'unknown' categorical value", () => {
    expect(computeResidual('unknown', stats(), 0.1)).toBeNull();
  });

  it('computes a standardized residual for a numeric signal', () => {
    // center 7, variability 1, observed 9 -> residual 2
    expect(computeResidual(9, stats(), 0.1)).toBe(2);
  });

  it('applies the variance floor to avoid division by zero', () => {
    const r = computeResidual(8, stats({ center: 7, variability: 0 }), 0.5);
    expect(r).toBe(2); // (8-7)/max(0,0.5) = 2
  });
});

describe('scoreObservation', () => {
  it('is 0 with no evaluable signals', () => {
    const obs: ObservationRecord = { timestamp: 't', signals: {}, completeness: 0, source: 'typed' };
    const result = scoreObservation(obs, {}, 0.1);
    expect(result.score).toBe(0);
    expect(result.perSignal).toEqual([]);
  });

  it('is the RMS of standardized residuals across evaluable signals', () => {
    const baseline: Baseline = { sleep: stats({ center: 7, variability: 1 }), pain: stats({ center: 0, variability: 1 }) };
    const obs: ObservationRecord = {
      timestamp: 't',
      signals: { sleep: 9, pain: 0 }, // residuals: 2, 0 -> rms = sqrt((4+0)/2) = sqrt(2)
      completeness: 0.25,
      source: 'typed',
    };
    const result = scoreObservation(obs, baseline, 0.1);
    expect(result.score).toBeCloseTo(Math.sqrt(2), 5);
  });

  it('produces explainable per-signal contributions summing to 1, sorted descending', () => {
    const baseline: Baseline = {
      sleep: stats({ center: 7, variability: 1 }),
      pain: stats({ center: 0, variability: 1 }),
    };
    const obs: ObservationRecord = {
      timestamp: 't',
      signals: { sleep: 9, pain: 1 }, // residuals: 2 and 1 -> sq: 4 and 1, contributions 0.8/0.2
      completeness: 0.25,
      source: 'typed',
    };
    const result = scoreObservation(obs, baseline, 0.1);
    expect(result.perSignal[0]?.signal).toBe('sleep');
    expect(result.perSignal[0]?.contribution).toBeCloseTo(0.8, 5);
    expect(result.perSignal[1]?.contribution).toBeCloseTo(0.2, 5);
    const total = result.perSignal.reduce((a, c) => a + c.contribution, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('skips signals with no baseline or unknown value without throwing', () => {
    const baseline: Baseline = { sleep: stats() };
    const obs: ObservationRecord = {
      timestamp: 't',
      signals: { sleep: 9, agitation: 'unknown', pain: 3 }, // pain has no baseline -> skipped
      completeness: 0.375,
      source: 'typed',
    };
    const result = scoreObservation(obs, baseline, 0.1);
    expect(result.perSignal).toHaveLength(1);
    expect(result.perSignal[0]?.signal).toBe('sleep');
  });
});

describe('detectChangepoint (CUSUM)', () => {
  it('does not trip on a stable series around baseline', () => {
    const { changepointDetected } = detectChangepoint([0, 0.2, -0.1, 0.3, 0, 0.1]);
    expect(changepointDetected).toBe(false);
  });

  it('does not trip on a single-day blip that reverts', () => {
    const { changepointDetected } = detectChangepoint([0, 0, 5, 0, 0, 0]);
    expect(changepointDetected).toBe(false);
  });

  it('trips on a sustained elevated shift', () => {
    const { changepointDetected } = detectChangepoint([0, 0.1, 2, 2, 2, 2, 2, 2]);
    expect(changepointDetected).toBe(true);
  });
});

describe('countTrailingPersistence', () => {
  const day = (score: number): DayScore => ({ timestamp: 't', score, perSignal: [], completeness: 1 });

  it('is 0 when the most recent day is not elevated', () => {
    expect(countTrailingPersistence([day(2), day(2), day(0.2)], 1)).toBe(0);
  });

  it('counts only the trailing run, stopping at the first non-elevated day walking backward', () => {
    expect(countTrailingPersistence([day(2), day(0.1), day(2), day(2)], 1)).toBe(2);
  });

  it('a single-day blip yields persistenceDays === 1, not an escalation-worthy streak', () => {
    expect(countTrailingPersistence([day(0.1), day(0.1), day(3)], 1)).toBe(1);
  });
});

describe('computeDeviation (integration, deterministic)', () => {
  function series(sleepValues: number[]): ObservationRecord[] {
    return sleepValues.map((v, i) => ({
      timestamp: `2026-06-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
      signals: { sleep: v },
      completeness: 0.125,
      source: 'typed' as const,
    }));
  }

  it('is deterministic: identical inputs always produce identical output', () => {
    const history = series([7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 3]);
    const baseline = updateBaseline(history.slice(0, -1), '2026-06-10T00:00:00.000Z');
    const a = computeDeviation(history, baseline, {}, '2026-06-11T00:00:00.000Z');
    const b = computeDeviation(history, baseline, {}, '2026-06-11T00:00:00.000Z');
    expect(a).toEqual(b);
  });

  it('empty history returns a zeroed, zero-confidence result rather than throwing', () => {
    const result = computeDeviation([], {}, {}, '2026-06-11T00:00:00.000Z');
    expect(result.score).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.persistenceDays).toBe(0);
  });

  it('a single-day blip does not accumulate persistence or trip the changepoint', () => {
    const history = series([7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 2]); // one bad night after 10 stable nights
    const baseline = updateBaseline(history.slice(0, -1), '2026-06-10T00:00:00.000Z');
    const result = computeDeviation(history, baseline, {}, '2026-06-11T00:00:00.000Z');
    expect(result.persistenceDays).toBeLessThanOrEqual(1);
    expect(result.changepointDetected).toBe(false);
  });

  it('a sustained multi-day deviation accumulates persistence and trips the changepoint', () => {
    const history = series([7, 7, 7, 7, 7, 7, 7, 7, 2, 2, 2, 2]); // 4 consecutive bad nights
    const baseline = updateBaseline(history.slice(0, -4), '2026-06-08T00:00:00.000Z');
    const result = computeDeviation(history, baseline, {}, '2026-06-12T00:00:00.000Z');
    expect(result.persistenceDays).toBeGreaterThanOrEqual(4);
    expect(result.changepointDetected).toBe(true);
  });

  it('per-signal contributions in the result explain which signal drove the score', () => {
    const history: ObservationRecord[] = [
      { timestamp: '2026-06-01T00:00:00.000Z', signals: { sleep: 7, pain: 0 }, completeness: 0.25, source: 'typed' },
      { timestamp: '2026-06-02T00:00:00.000Z', signals: { sleep: 7, pain: 0 }, completeness: 0.25, source: 'typed' },
      { timestamp: '2026-06-03T00:00:00.000Z', signals: { sleep: 7, pain: 0 }, completeness: 0.25, source: 'typed' },
      { timestamp: '2026-06-04T00:00:00.000Z', signals: { sleep: 1, pain: 0 }, completeness: 0.25, source: 'typed' },
    ];
    const baseline = updateBaseline(history.slice(0, 3), '2026-06-03T00:00:00.000Z');
    const result = computeDeviation(history, baseline, {}, '2026-06-04T00:00:00.000Z');
    expect(result.perSignal[0]?.signal).toBe('sleep');
    expect(result.perSignal[0]?.contribution).toBeGreaterThan(0.9);
  });
});
