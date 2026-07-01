import { describe, expect, it } from 'vitest';
import { validateObservation } from '@/types/validateObservation';

function validRecord() {
  return {
    timestamp: '2026-06-30T08:00:00.000Z',
    signals: {
      sleep: 6.5,
      intake: 'normal',
      agitation: 'low',
      pain: 'unknown',
    },
    note: 'Slept later than usual, ate breakfast fine.',
    completeness: 0.5,
    source: 'typed',
  };
}

describe('validateObservation', () => {
  it('accepts a well-formed record', () => {
    const result = validateObservation(validRecord());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.record.signals.sleep).toBe(6.5);
    }
  });

  it('accepts a record with no signals present (0 completeness)', () => {
    const result = validateObservation({ ...validRecord(), signals: {}, completeness: 0 });
    expect(result.valid).toBe(true);
  });

  it('rejects non-object input', () => {
    expect(validateObservation(null).valid).toBe(false);
    expect(validateObservation('a string').valid).toBe(false);
    expect(validateObservation(42).valid).toBe(false);
    expect(validateObservation(undefined).valid).toBe(false);
  });

  it('rejects an invalid timestamp', () => {
    const result = validateObservation({ ...validRecord(), timestamp: 'not-a-date' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.startsWith('timestamp'))).toBe(true);
    }
  });

  it('rejects an unknown signal key', () => {
    const record = validRecord();
    const result = validateObservation({
      ...record,
      signals: { ...record.signals, mood: 'high' },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('mood'))).toBe(true);
    }
  });

  it('rejects an out-of-range signal category', () => {
    const record = validRecord();
    const result = validateObservation({
      ...record,
      signals: { ...record.signals, agitation: 'extremely-high' },
    });
    expect(result.valid).toBe(false);
  });

  it('rejects completeness outside 0..1', () => {
    expect(validateObservation({ ...validRecord(), completeness: 1.5 }).valid).toBe(false);
    expect(validateObservation({ ...validRecord(), completeness: -0.1 }).valid).toBe(false);
  });

  it('rejects an unknown source', () => {
    const result = validateObservation({ ...validRecord(), source: 'telepathy' });
    expect(result.valid).toBe(false);
  });

  it('rejects a non-string note', () => {
    const result = validateObservation({ ...validRecord(), note: 12345 });
    expect(result.valid).toBe(false);
  });

  it('accumulates multiple errors at once', () => {
    const result = validateObservation({
      timestamp: 'bad',
      signals: { unknownSignal: true },
      completeness: 5,
      source: 'fax',
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('simulates rejecting off-schema LLM output (guardrail #3)', () => {
    // e.g. a model that returned prose instead of JSON, or hallucinated a field shape
    const malformedLlmOutput = {
      timestamp: '2026-06-30T08:00:00.000Z',
      signals: 'patient slept fine and ate well',
      completeness: 0.5,
      source: 'voice',
    };
    const result = validateObservation(malformedLlmOutput);
    expect(result.valid).toBe(false);
  });
});
