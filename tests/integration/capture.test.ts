import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { _clearAll, _resetDatabaseHandle, getAllObservations } from '@/storage';
import { buildTypedObservation } from '@/capture/typed/typedCapture';
import { submitObservation } from '@/capture/submit';
import { isSpeechRecognitionSupported } from '@/capture/asr/speechToText';
import { captureFromImage } from '@/capture/ocr/ocrStub';

describe('buildTypedObservation (guaranteed, LLM-free capture path)', () => {
  it('builds a valid record from structured field input', () => {
    const result = buildTypedObservation(
      { signals: { sleep: 7, agitation: 'low' }, note: 'Good day' },
      'typed',
      '2026-06-30T00:00:00.000Z'
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.record.completeness).toBeCloseTo(2 / 8, 5);
    }
  });

  it('builds a valid (zero-completeness) record even with no signals filled in', () => {
    const result = buildTypedObservation({ signals: {} });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.record.completeness).toBe(0);
    }
  });
});

describe('capture -> storage integration: input results in a persisted record (M9 done-criterion)', () => {
  beforeEach(async () => {
    _resetDatabaseHandle();
    await _clearAll();
  });

  it('a typed submission is retrievable afterward', async () => {
    const built = buildTypedObservation(
      { signals: { sleep: 6, pain: 'high' }, note: 'Restless night' },
      'typed',
      '2026-06-30T00:00:00.000Z'
    );
    expect(built.valid).toBe(true);
    if (!built.valid) return;

    const { id } = await submitObservation(built.record);
    expect(typeof id).toBe('number');

    const stored = await getAllObservations();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.signals.pain).toBe('high');
    expect(stored[0]?.note).toBe('Restless night');
  });
});

describe('WebSpeechVoiceCaptureAdapter feature detection', () => {
  it('reports unsupported in this test environment (jsdom has no SpeechRecognition)', () => {
    expect(isSpeechRecognitionSupported()).toBe(false);
  });
});

describe('OCR stub (deferred per CLAUDE.md §6)', () => {
  it('reports itself as unsupported rather than silently pretending to work', async () => {
    const result = await captureFromImage(new Blob());
    expect(result.supported).toBe(false);
    expect(result.reason.length).toBeGreaterThan(0);
  });
});
