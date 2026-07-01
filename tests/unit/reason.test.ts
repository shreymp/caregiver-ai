import { describe, expect, it } from 'vitest';
import { checkExplanationConsistentWithTier } from '@/reason/consistency';
import { buildDeterministicFallbackExplanation } from '@/reason/fallback';
import { explainDeviation } from '@/reason/explainDeviation';
import { UNSURE_EXPLANATION_MESSAGE } from '@/reason/unsureMessage';
import type { LlmEngine, LlmLoadProgress } from '@/parse/llmEngine';
import type { DeviationResult, TierResult } from '@/types';

class FakeLlmEngine implements LlmEngine {
  isLoaded = true;
  calls = 0;
  constructor(private readonly response: string) {}
  load(_onProgress?: (p: LlmLoadProgress) => void): Promise<void> {
    return Promise.resolve();
  }
  completeJson(_systemPrompt: string, _userPrompt: string, _jsonSchema: string): Promise<string> {
    this.calls += 1;
    return Promise.resolve(this.response);
  }
  unload(): Promise<void> {
    return Promise.resolve();
  }
}

function deviation(overrides: Partial<DeviationResult> = {}): DeviationResult {
  return {
    timestamp: '2026-06-30T00:00:00.000Z',
    score: 2.1,
    perSignal: [{ signal: 'sleep', observedValue: 3, residual: 2.1, contribution: 1 }],
    confidence: 0.8,
    persistenceDays: 3,
    changepointDetected: true,
    ...overrides,
  };
}

function tier(overrides: Partial<TierResult> = {}): TierResult {
  return { tier: 'watch', reason: 'score sustained 3 days', overriddenBySafety: false, ...overrides };
}

describe('checkExplanationConsistentWithTier', () => {
  it('is consistent for a watch-tier explanation using only mild language', () => {
    const result = checkExplanationConsistentWithTier('watch', 'Sleep has been a bit shorter than usual for a few days — worth keeping an eye on.');
    expect(result.consistent).toBe(true);
  });

  it('flags a watch-tier explanation that uses emergency/escalation language', () => {
    const result = checkExplanationConsistentWithTier('watch', 'This is an emergency, act immediately.');
    expect(result.consistent).toBe(false);
  });

  it('flags a watch-tier explanation that tells the caregiver to call a clinician', () => {
    const result = checkExplanationConsistentWithTier('watch', 'You should call the doctor about this right now.');
    expect(result.consistent).toBe(false);
  });

  it('flags a call-tier explanation that uses escalation/emergency language', () => {
    const result = checkExplanationConsistentWithTier('call', 'This is urgent, an emergency.');
    expect(result.consistent).toBe(false);
  });

  it('flags a call-tier explanation that reassures there is nothing to worry about', () => {
    const result = checkExplanationConsistentWithTier('call', "Nothing to worry about, all's fine.");
    expect(result.consistent).toBe(false);
  });

  it('flags an escalate-tier explanation that downplays with reassurance language', () => {
    const result = checkExplanationConsistentWithTier('escalate', 'Not serious, no need to act.');
    expect(result.consistent).toBe(false);
  });

  it('does not flag escalation language when the tier actually is escalate', () => {
    const result = checkExplanationConsistentWithTier('escalate', 'This looks urgent and warrants prompt attention.');
    expect(result.consistent).toBe(true);
  });
});

describe('buildDeterministicFallbackExplanation', () => {
  it('names the tier and reason, and names the top contributing signal', () => {
    const text = buildDeterministicFallbackExplanation(deviation(), tier());
    expect(text).toContain('watch');
    expect(text).toContain('score sustained 3 days');
    expect(text).toContain('sleep');
  });

  it('never fabricates a different tier than the one given', () => {
    const text = buildDeterministicFallbackExplanation(deviation(), tier({ tier: 'escalate', reason: 'x' }));
    expect(text).toContain('escalate');
    expect(text).not.toContain('"watch"');
  });
});

describe('explainDeviation', () => {
  it("uses the fixed unsure message and never calls the LLM when tier is 'unsure'", async () => {
    const engine = new FakeLlmEngine('should never be read');
    const result = await explainDeviation(engine, deviation(), tier({ tier: 'unsure', overriddenBySafety: true }));
    expect(result.explanation).toBe(UNSURE_EXPLANATION_MESSAGE);
    expect(result.usedFallback).toBe(true);
    expect(engine.calls).toBe(0);
  });

  it('passes through a well-formed, tier-consistent model explanation', async () => {
    const engine = new FakeLlmEngine(JSON.stringify({ explanation: 'Sleep has dipped for a few days — worth keeping an eye on things.' }));
    const result = await explainDeviation(engine, deviation(), tier({ tier: 'watch' }));
    expect(result.usedFallback).toBe(false);
    expect(result.explanation).toContain('Sleep has dipped');
  });

  it('falls back to the deterministic template when the model returns invalid JSON', async () => {
    const engine = new FakeLlmEngine('not json at all');
    const result = await explainDeviation(engine, deviation(), tier({ tier: 'watch' }));
    expect(result.usedFallback).toBe(true);
    expect(result.explanation).toContain('watch');
  });

  it('falls back to the deterministic template when the model output is missing the explanation field', async () => {
    const engine = new FakeLlmEngine(JSON.stringify({ summary: 'oops wrong field' }));
    const result = await explainDeviation(engine, deviation(), tier({ tier: 'watch' }));
    expect(result.usedFallback).toBe(true);
  });

  it('falls back to the deterministic template when the model contradicts a watch tier with escalation language', async () => {
    const engine = new FakeLlmEngine(JSON.stringify({ explanation: 'This is an emergency — act immediately and call 911.' }));
    const result = await explainDeviation(engine, deviation(), tier({ tier: 'watch', reason: 'mild sustained change' }));
    expect(result.usedFallback).toBe(true);
    expect(result.explanation).toContain('watch');
    expect(result.explanation.toLowerCase()).not.toContain('911');
  });

  it('always returns the raw model output for audit logging when the LLM was actually called', async () => {
    const raw = JSON.stringify({ explanation: 'fine' });
    const engine = new FakeLlmEngine(raw);
    const result = await explainDeviation(engine, deviation(), tier({ tier: 'watch' }));
    expect(result.rawModelOutput).toBe(raw);
  });
});
