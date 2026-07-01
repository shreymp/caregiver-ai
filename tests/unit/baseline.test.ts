import { describe, expect, it } from 'vitest';
import { median, medianAbsoluteDeviation, ewma } from '@/baseline/robustStats';
import { encodeSignalValue } from '@/baseline/encode';
import { updateBaseline, updateSignalBaseline, extractSignalHistory } from '@/baseline/updateBaseline';
import type { ObservationRecord } from '@/types';

describe('robustStats', () => {
  it('median: odd-length array', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('median: even-length array averages the two middle values', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('median: empty array is 0', () => {
    expect(median([])).toBe(0);
  });

  it('medianAbsoluteDeviation: constant series has zero variability', () => {
    expect(medianAbsoluteDeviation([5, 5, 5, 5], 5)).toBe(0);
  });

  it('medianAbsoluteDeviation: is scaled for normal-consistency', () => {
    // deviations from center=5: [1,1,1,1,5] -> median deviation 1, scaled by 1.4826
    const mad = medianAbsoluteDeviation([4, 4, 6, 6, 10], 5);
    expect(mad).toBeCloseTo(1.4826, 3);
  });

  it('ewma: seeds from first value with a single element', () => {
    expect(ewma([42], 0.3)).toBe(42);
  });

  it('ewma: weights recent values more with a higher alpha', () => {
    const slow = ewma([0, 0, 0, 10], 0.1);
    const fast = ewma([0, 0, 0, 10], 0.9);
    expect(fast).toBeGreaterThan(slow);
  });
});

describe('encodeSignalValue', () => {
  it('passes finite numbers through unchanged', () => {
    expect(encodeSignalValue(6.5)).toBe(6.5);
  });

  it('maps categorical values to a fixed ordinal scale', () => {
    expect(encodeSignalValue('low')).toBe(-1);
    expect(encodeSignalValue('normal')).toBe(0);
    expect(encodeSignalValue('high')).toBe(1);
  });

  it('treats "unknown" as missing (null)', () => {
    expect(encodeSignalValue('unknown')).toBeNull();
  });

  it('treats non-finite numbers as missing (null)', () => {
    expect(encodeSignalValue(Number.NaN)).toBeNull();
  });
});

function record(timestamp: string, sleep?: number): ObservationRecord {
  return {
    timestamp,
    signals: sleep === undefined ? {} : { sleep },
    completeness: sleep === undefined ? 0 : 0.125,
    source: 'typed',
  };
}

describe('updateSignalBaseline (cold-start + online update)', () => {
  it('cold start: no history yields undefined (no baseline yet)', () => {
    expect(updateSignalBaseline([], '2026-06-30T00:00:00.000Z')).toBeUndefined();
  });

  it('a single sample yields a defined baseline with low confidence', () => {
    const stats = updateSignalBaseline(
      [{ timestamp: '2026-06-28T00:00:00.000Z', value: 7 }],
      '2026-06-28T00:00:00.000Z',
      { fullConfidenceSampleCount: 14 }
    );
    expect(stats).toBeDefined();
    expect(stats?.center).toBe(7);
    expect(stats?.variability).toBe(0);
    expect(stats?.confidence).toBeCloseTo(1 / 14, 5);
  });

  it('confidence ramps toward 1 as samples accumulate, capped at 1', () => {
    const history = Array.from({ length: 20 }, (_, i) => ({
      timestamp: `2026-06-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
      value: 7,
    }));
    const stats = updateSignalBaseline(history, '2026-06-20T00:00:00.000Z', {
      fullConfidenceSampleCount: 14,
      windowSize: 30,
    });
    expect(stats?.confidence).toBe(1);
  });

  it('only uses the most recent `windowSize` samples', () => {
    const history = [
      ...Array.from({ length: 25 }, (_, i) => ({ timestamp: `d${i}`, value: 100 })),
      { timestamp: 'd25', value: 7 },
      { timestamp: 'd26', value: 7 },
      { timestamp: 'd27', value: 7 },
    ];
    const stats = updateSignalBaseline(history, 'now', { windowSize: 3 });
    expect(stats?.center).toBe(7);
    expect(stats?.sampleCount).toBe(3);
  });
});

describe('extractSignalHistory + updateBaseline (missing-day tolerance)', () => {
  it('extractSignalHistory skips observations where the signal is absent', () => {
    const observations = [record('2026-06-28T00:00:00.000Z', 7), record('2026-06-29T00:00:00.000Z')];
    const history = extractSignalHistory(observations, 'sleep');
    expect(history).toHaveLength(1);
    expect(history[0]?.value).toBe(7);
  });

  it('updateBaseline only populates signals that have at least one data point', () => {
    const observations = [record('2026-06-28T00:00:00.000Z', 7)];
    const baseline = updateBaseline(observations, '2026-06-28T00:00:00.000Z');
    expect(baseline.sleep).toBeDefined();
    expect(baseline.agitation).toBeUndefined();
  });

  it('updateBaseline sorts out-of-order input by timestamp before computing', () => {
    const observations = [
      record('2026-06-30T00:00:00.000Z', 9),
      record('2026-06-28T00:00:00.000Z', 5),
      record('2026-06-29T00:00:00.000Z', 7),
    ];
    const baseline = updateBaseline(observations, '2026-06-30T00:00:00.000Z');
    // ewma folded in chronological order 5 -> 7 -> 9, not insertion order
    expect(baseline.sleep?.sampleCount).toBe(3);
    expect(baseline.sleep?.center).toBe(7);
  });

  it('a gap of missing days does not corrupt the baseline for the days that do have data', () => {
    const observations = [
      record('2026-06-01T00:00:00.000Z', 7),
      record('2026-06-15T00:00:00.000Z'), // 2-week gap, no sleep signal this day
      record('2026-06-28T00:00:00.000Z', 7),
    ];
    const baseline = updateBaseline(observations, '2026-06-28T00:00:00.000Z');
    expect(baseline.sleep?.sampleCount).toBe(2);
    expect(baseline.sleep?.center).toBe(7);
  });
});
