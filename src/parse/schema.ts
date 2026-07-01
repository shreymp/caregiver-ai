import { SIGNAL_CATEGORIES, SIGNAL_KEYS } from '@/types';

/**
 * JSON Schema string describing the ONLY shape the parse-stage LLM may
 * produce: a `signals` map over the known signal keys. Deliberately does not
 * ask the model for `completeness`, `timestamp`, or `source` — those are
 * computed/assigned in code, never by the model (CLAUDE.md guardrail #1:
 * the LLM parses and explains, it never computes a score or decides
 * anything). Generated from SIGNAL_KEYS/SIGNAL_CATEGORIES so it can't drift
 * from the schema validator in src/types/validateObservation.ts.
 */
export function buildParseJsonSchema(): string {
  const signalValueSchema = {
    anyOf: [{ type: 'number' }, { enum: [...SIGNAL_CATEGORIES] }],
  };
  const properties: Record<string, unknown> = {};
  for (const key of SIGNAL_KEYS) {
    properties[key] = signalValueSchema;
  }
  const schema = {
    type: 'object',
    properties: {
      signals: {
        type: 'object',
        properties,
        additionalProperties: false,
      },
    },
    required: ['signals'],
    additionalProperties: false,
  };
  return JSON.stringify(schema);
}
