import type { DeviationResult, TierResult } from '@/types';

/**
 * Deterministic, template-based explanation built directly from the
 * structured result — used whenever the LLM's output can't be trusted
 * (invalid JSON, missing field, or fails the tier-consistency check). This
 * guarantees the explanation always matches the tier even if the model
 * misbehaves, since it doesn't touch the model's words at all.
 */
export function buildDeterministicFallbackExplanation(deviation: DeviationResult, tier: TierResult): string {
  const topSignal = deviation.perSignal[0];
  const signalPhrase = topSignal ? `mainly driven by ${topSignal.signal}` : 'based on the observations recorded';
  const persistencePhrase =
    deviation.persistenceDays > 1 ? `, sustained over ${deviation.persistenceDays} consecutive days` : '';
  return (
    `This result (${signalPhrase}${persistencePhrase}) was classified as "${tier.tier}": ${tier.reason}. ` +
    'This is decision support only — you know the person best; use your own judgment alongside this information.'
  );
}
