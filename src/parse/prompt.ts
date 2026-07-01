import { SIGNAL_KEYS } from '@/types';

/**
 * System prompt for the parse-stage LLM. Explicitly forbids inventing
 * values and requires omitting anything not actually mentioned in the text
 * — the model's only job is extraction, never judgment about what the
 * extracted values mean (that's src/detect + src/tier).
 */
export function buildParseSystemPrompt(): string {
  return [
    "You convert a caregiver's free-text note about the person they support into structured signal values.",
    `The only signals you may report are: ${SIGNAL_KEYS.join(', ')}.`,
    'For each signal, output either a number, or one of "low", "normal", "high", "unknown".',
    'Only include a signal in your output if the text actually discusses it. If the text does not mention a signal at all, omit that key entirely — do not guess or fill in a default.',
    'If the text discusses a signal but the direction or severity is genuinely unclear from the wording, use "unknown" rather than guessing.',
    'Never invent facts that are not in the text. Never add commentary, reasoning, or any field beyond the required JSON object.',
    'Output strictly the required JSON object and nothing else.',
  ].join('\n');
}
