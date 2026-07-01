import type { DeviationResult, TierResult } from '@/types';
import type { LlmEngine } from '@/parse/llmEngine';
import { checkExplanationConsistentWithTier } from './consistency';
import { buildDeterministicFallbackExplanation } from './fallback';
import { buildExplanationSystemPrompt, buildExplanationUserPrompt } from './prompt';
import { buildExplanationJsonSchema } from './schema';
import { UNSURE_EXPLANATION_MESSAGE } from './unsureMessage';

export interface ExplanationResult {
  explanation: string;
  rawModelOutput?: string;
  /** True when a fixed/deterministic message was used instead of the model's own words (unsure tier, invalid output, or a tier-consistency violation). */
  usedFallback: boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Verbalizes an already-computed DeviationResult + TierResult in plain
 * language. Never decides anything itself (CLAUDE.md guardrail #1): the
 * tier is fixed input, not output. Three independent layers keep this true
 * even if the model misbehaves: (1) 'unsure' always uses a fixed message,
 * never the LLM; (2) malformed/off-schema model output falls back to a
 * deterministic template; (3) well-formed output is still checked for
 * tier-contradicting language and replaced with the deterministic template
 * if it fails that check.
 *
 * `getEngine` is a lazy factory rather than a resolved engine: when the
 * tier is 'unsure' the LLM is never invoked, so callers should not have to
 * pay for (or trigger) a multi-GB model download just to satisfy this
 * function's signature.
 */
export async function explainDeviation(
  getEngine: () => Promise<LlmEngine>,
  deviation: DeviationResult,
  tier: TierResult
): Promise<ExplanationResult> {
  if (tier.tier === 'unsure') {
    return { explanation: UNSURE_EXPLANATION_MESSAGE, usedFallback: true };
  }

  const engine = await getEngine();
  const rawModelOutput = await engine.completeJson(
    buildExplanationSystemPrompt(),
    buildExplanationUserPrompt(deviation, tier),
    buildExplanationJsonSchema()
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawModelOutput);
  } catch {
    return { explanation: buildDeterministicFallbackExplanation(deviation, tier), rawModelOutput, usedFallback: true };
  }

  if (!isPlainObject(parsed) || typeof parsed.explanation !== 'string' || parsed.explanation.trim() === '') {
    return { explanation: buildDeterministicFallbackExplanation(deviation, tier), rawModelOutput, usedFallback: true };
  }

  const check = checkExplanationConsistentWithTier(tier.tier, parsed.explanation);
  if (!check.consistent) {
    return { explanation: buildDeterministicFallbackExplanation(deviation, tier), rawModelOutput, usedFallback: true };
  }

  return { explanation: parsed.explanation, rawModelOutput, usedFallback: false };
}
