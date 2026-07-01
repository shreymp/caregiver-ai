import { afterEach, describe, expect, it, vi } from 'vitest';
import { SIGNAL_KEYS } from '@/types';
import { buildParseJsonSchema } from '@/parse/schema';
import { buildParseSystemPrompt } from '@/parse/prompt';
import { parseObservationText } from '@/parse/parseObservation';
import { isWebGpuAvailable, getRecommendedCaptureMode } from '@/parse/webgpu';
import type { LlmEngine, LlmLoadProgress } from '@/parse/llmEngine';

class FakeLlmEngine implements LlmEngine {
  isLoaded = true;
  constructor(private readonly response: string) {}
  load(_onProgress?: (p: LlmLoadProgress) => void): Promise<void> {
    return Promise.resolve();
  }
  completeJson(_systemPrompt: string, _userPrompt: string, _jsonSchema: string): Promise<string> {
    return Promise.resolve(this.response);
  }
  unload(): Promise<void> {
    return Promise.resolve();
  }
}

describe('buildParseJsonSchema', () => {
  it('produces valid JSON describing all known signal keys', () => {
    const schema = JSON.parse(buildParseJsonSchema());
    expect(schema.required).toEqual(['signals']);
    const signalProps = Object.keys(schema.properties.signals.properties);
    expect(signalProps.sort()).toEqual([...SIGNAL_KEYS].sort());
  });

  it('does not ask the model for completeness, timestamp, or source (guardrail #1)', () => {
    const schema = buildParseJsonSchema();
    expect(schema).not.toContain('completeness');
    expect(schema).not.toContain('timestamp');
  });
});

describe('buildParseSystemPrompt', () => {
  it('instructs the model to omit unmentioned signals rather than guess', () => {
    const prompt = buildParseSystemPrompt();
    expect(prompt.toLowerCase()).toContain('omit');
    expect(prompt.toLowerCase()).toContain('unknown');
  });
});

describe('parseObservationText', () => {
  it('accepts well-formed model JSON and produces a valid, schema-checked record', async () => {
    const engine = new FakeLlmEngine(JSON.stringify({ signals: { sleep: 6, agitation: 'high' } }));
    const result = await parseObservationText(engine, 'Slept 6 hours, seemed agitated.', 'voice', '2026-06-30T00:00:00.000Z');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.record.signals.sleep).toBe(6);
      expect(result.record.signals.agitation).toBe('high');
      expect(result.record.note).toBe('Slept 6 hours, seemed agitated.');
      expect(result.record.completeness).toBeCloseTo(2 / SIGNAL_KEYS.length, 5);
      expect(result.record.source).toBe('voice');
    }
  });

  it('rejects non-JSON model output rather than passing it downstream', async () => {
    const engine = new FakeLlmEngine('I think the caregiver seems worried, sleep is fine.');
    const result = await parseObservationText(engine, 'some note', 'voice');
    expect(result.success).toBe(false);
  });

  it('rejects JSON missing the required `signals` object', async () => {
    const engine = new FakeLlmEngine(JSON.stringify({ sleep: 6 }));
    const result = await parseObservationText(engine, 'some note', 'voice');
    expect(result.success).toBe(false);
  });

  it('rejects an off-schema signal key or value via validateObservation (guardrail #3)', async () => {
    const engine = new FakeLlmEngine(JSON.stringify({ signals: { mood: 'great' } }));
    const result = await parseObservationText(engine, 'some note', 'voice');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes('mood'))).toBe(true);
    }
  });

  it('rejects a signal value that is neither a finite number nor a known category', async () => {
    const engine = new FakeLlmEngine('{"signals": {"sleep": "many"}}');
    const result = await parseObservationText(engine, 'some note', 'voice');
    expect(result.success).toBe(false);
  });

  it('always returns the raw model output alongside the result for audit logging', async () => {
    const raw = JSON.stringify({ signals: { sleep: 7 } });
    const engine = new FakeLlmEngine(raw);
    const result = await parseObservationText(engine, 'note', 'typed');
    expect(result.rawModelOutput).toBe(raw);
  });
});

describe('WebGPU feature detection (guardrail #9)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports unavailable when navigator.gpu does not exist (e.g. this test environment)', async () => {
    expect(await isWebGpuAvailable()).toBe(false);
    expect(await getRecommendedCaptureMode()).toBe('typed-structured');
  });

  it('reports unavailable when requestAdapter resolves to null', async () => {
    vi.stubGlobal('navigator', { gpu: { requestAdapter: () => Promise.resolve(null) } });
    expect(await isWebGpuAvailable()).toBe(false);
  });

  it('reports unavailable when requestAdapter throws', async () => {
    vi.stubGlobal('navigator', {
      gpu: {
        requestAdapter: () => {
          throw new Error('no GPU');
        },
      },
    });
    expect(await isWebGpuAvailable()).toBe(false);
  });

  it('reports available when an adapter is returned, recommending llm-assisted capture', async () => {
    vi.stubGlobal('navigator', { gpu: { requestAdapter: () => Promise.resolve({}) } });
    expect(await isWebGpuAvailable()).toBe(true);
    expect(await getRecommendedCaptureMode()).toBe('llm-assisted');
  });
});
