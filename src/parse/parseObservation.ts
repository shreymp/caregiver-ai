import { SIGNAL_KEYS, validateObservation, type CaptureSource, type ObservationRecord } from '@/types';
import type { LlmEngine } from './llmEngine';
import { buildParseSystemPrompt } from './prompt';
import { buildParseJsonSchema } from './schema';

export type ParseObservationResult =
  | { success: true; record: ObservationRecord; rawModelOutput: string }
  | { success: false; errors: string[]; rawModelOutput?: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Fraction of the known signal set present — computed in code, never asked of the model (guardrail #1). */
function computeCompleteness(signals: Record<string, unknown>): number {
  const present = SIGNAL_KEYS.filter((key) => key in signals).length;
  return present / SIGNAL_KEYS.length;
}

/**
 * Parses free-text caregiver input into a schema-validated ObservationRecord
 * via the LLM. The LLM only extracts `signals`; timestamp/source are
 * supplied by the caller and completeness/note are derived in code — the
 * model never computes a score or decides anything (guardrail #1). Every
 * path back through this function is schema-validated (guardrail #3); any
 * off-schema model output is rejected, never passed downstream.
 */
export async function parseObservationText(
  engine: LlmEngine,
  rawText: string,
  source: CaptureSource,
  now: string = new Date().toISOString()
): Promise<ParseObservationResult> {
  const rawModelOutput = await engine.completeJson(buildParseSystemPrompt(), rawText, buildParseJsonSchema());

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawModelOutput);
  } catch {
    return { success: false, errors: ['model did not return valid JSON'], rawModelOutput };
  }

  if (!isPlainObject(parsedJson) || !isPlainObject(parsedJson.signals)) {
    return { success: false, errors: ['model output is missing a `signals` object'], rawModelOutput };
  }

  const candidate = {
    timestamp: now,
    signals: parsedJson.signals,
    note: rawText,
    completeness: computeCompleteness(parsedJson.signals),
    source,
  };

  const validation = validateObservation(candidate);
  if (!validation.valid) {
    return { success: false, errors: validation.errors, rawModelOutput };
  }

  return { success: true, record: validation.record, rawModelOutput };
}
