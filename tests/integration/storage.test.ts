import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  _clearAll,
  _resetDatabaseHandle,
  addObservation,
  deleteObservation,
  exportAll,
  getAllObservations,
  getBaseline,
  setBaseline,
} from '@/storage';
import type { Baseline, ObservationRecord } from '@/types';

function makeRecord(timestamp: string): ObservationRecord {
  return {
    timestamp,
    signals: { sleep: 7, agitation: 'low' },
    completeness: 0.25,
    source: 'typed',
  };
}

describe('storage (IndexedDB CRUD + export)', () => {
  beforeEach(async () => {
    _resetDatabaseHandle();
    await _clearAll();
  });

  it('round-trips an observation through add + getAll', async () => {
    await addObservation(makeRecord('2026-06-28T08:00:00.000Z'));
    const all = await getAllObservations();
    expect(all).toHaveLength(1);
    expect(all[0]?.signals.sleep).toBe(7);
  });

  it('returns observations sorted ascending by timestamp regardless of insert order', async () => {
    await addObservation(makeRecord('2026-06-30T08:00:00.000Z'));
    await addObservation(makeRecord('2026-06-28T08:00:00.000Z'));
    await addObservation(makeRecord('2026-06-29T08:00:00.000Z'));
    const all = await getAllObservations();
    expect(all.map((r) => r.timestamp)).toEqual([
      '2026-06-28T08:00:00.000Z',
      '2026-06-29T08:00:00.000Z',
      '2026-06-30T08:00:00.000Z',
    ]);
  });

  it('deletes an observation by id', async () => {
    const id = await addObservation(makeRecord('2026-06-28T08:00:00.000Z'));
    await deleteObservation(id);
    expect(await getAllObservations()).toHaveLength(0);
  });

  it('getBaseline returns an empty object before any baseline is set', async () => {
    expect(await getBaseline()).toEqual({});
  });

  it('round-trips a baseline through setBaseline + getBaseline', async () => {
    const baseline: Baseline = {
      sleep: {
        center: 7,
        variability: 0.5,
        ewma: 7.1,
        sampleCount: 10,
        lastUpdated: '2026-06-30T00:00:00.000Z',
        confidence: 0.8,
      },
    };
    await setBaseline(baseline);
    expect(await getBaseline()).toEqual(baseline);
  });

  it('exportAll bundles observations + baseline with an export timestamp', async () => {
    await addObservation(makeRecord('2026-06-28T08:00:00.000Z'));
    await setBaseline({ sleep: { center: 7, variability: 0.5, ewma: 7, sampleCount: 1, lastUpdated: '2026-06-28T00:00:00.000Z', confidence: 0.2 } });

    const payload = await exportAll();
    expect(payload.observations).toHaveLength(1);
    expect(payload.baseline.sleep?.center).toBe(7);
    expect(() => new Date(payload.exportedAt).toISOString()).not.toThrow();
  });
});
