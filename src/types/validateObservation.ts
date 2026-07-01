import { SIGNAL_CATEGORIES, SIGNAL_KEYS, type ObservationRecord } from './observation';

export type ValidationResult =
  | { valid: true; record: ObservationRecord }
  | { valid: false; errors: string[] };

const CAPTURE_SOURCES = ['typed', 'voice', 'ocr'] as const;
const SIGNAL_KEY_SET: ReadonlySet<string> = new Set(SIGNAL_KEYS);
const SIGNAL_CATEGORY_SET: ReadonlySet<string> = new Set(SIGNAL_CATEGORIES);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

/**
 * Schema-validates an unknown value (e.g. raw LLM parse output, or a typed-UI
 * form payload) against the ObservationRecord contract. Per CLAUDE.md
 * guardrail #3, nothing downstream may trust unvalidated model output — this
 * is the single required gate. Never throws; always returns a result.
 */
export function validateObservation(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(input)) {
    return { valid: false, errors: ['input is not an object'] };
  }

  if (!isValidIsoTimestamp(input.timestamp)) {
    errors.push('timestamp: must be a valid ISO 8601 date string');
  }

  if (!isPlainObject(input.signals)) {
    errors.push('signals: must be an object');
  } else {
    for (const [key, value] of Object.entries(input.signals)) {
      if (!SIGNAL_KEY_SET.has(key)) {
        errors.push(`signals.${key}: unknown signal key (expected one of ${SIGNAL_KEYS.join(', ')})`);
        continue;
      }
      const isNumeric = typeof value === 'number' && Number.isFinite(value);
      const isCategory = typeof value === 'string' && SIGNAL_CATEGORY_SET.has(value);
      if (!isNumeric && !isCategory) {
        errors.push(
          `signals.${key}: must be a finite number or one of ${SIGNAL_CATEGORIES.join(', ')}`
        );
      }
    }
  }

  if (input.note !== undefined && typeof input.note !== 'string') {
    errors.push('note: must be a string when present');
  }

  if (
    typeof input.completeness !== 'number' ||
    !Number.isFinite(input.completeness) ||
    input.completeness < 0 ||
    input.completeness > 1
  ) {
    errors.push('completeness: must be a number between 0 and 1');
  }

  if (typeof input.source !== 'string' || !CAPTURE_SOURCES.includes(input.source as never)) {
    errors.push(`source: must be one of ${CAPTURE_SOURCES.join(', ')}`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, record: input as unknown as ObservationRecord };
}
