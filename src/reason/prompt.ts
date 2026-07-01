import type { DeviationResult, TierResult } from '@/types';

export function buildExplanationSystemPrompt(): string {
  return [
    'You explain an already-computed result to a caregiver in plain, warm, non-clinical language.',
    'You are given a fixed action tier and the statistical reasoning behind it. You must never change, contradict, soften, or escalate that tier — only explain it in plain words.',
    'Never diagnose, never name a medical condition or cause, never tell the caregiver what to do. Describe what changed and frame this as decision support the caregiver can weigh alongside their own judgment, not an instruction.',
    'Output strictly the required JSON object and nothing else.',
  ].join('\n');
}

export function buildExplanationUserPrompt(deviation: DeviationResult, tier: TierResult): string {
  const signalLines = deviation.perSignal
    .slice(0, 3)
    .map(
      (s) =>
        `- ${s.signal}: observed ${JSON.stringify(s.observedValue)}, contributes ${(s.contribution * 100).toFixed(0)}% of the overall deviation`
    )
    .join('\n');

  return [
    `Computed tier: ${tier.tier}`,
    `Tier reason: ${tier.reason}`,
    `Overall deviation score: ${deviation.score.toFixed(2)}`,
    `Confidence: ${(deviation.confidence * 100).toFixed(0)}%`,
    `Persistence: ${deviation.persistenceDays} consecutive day(s)`,
    `Changepoint detected: ${deviation.changepointDetected ? 'yes' : 'no'}`,
    signalLines ? `Top contributing signals:\n${signalLines}` : 'No individual signal stood out strongly.',
  ].join('\n');
}
