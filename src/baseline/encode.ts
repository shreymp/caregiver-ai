import type { SignalValue } from '@/types';

/**
 * Ordinal encoding for categorical signal values so the same robust-statistics
 * machinery (median/MAD/EWMA) works for both numeric and categorical signals.
 * This is a generic statistical convenience, not a clinical judgment — it does
 * not assert that "high" is worse than "low" for any given signal; src/tier
 * (sourced from the labeling rubric) is what assigns clinical meaning.
 */
const CATEGORY_ORDINAL: Record<'low' | 'normal' | 'high', number> = {
  low: -1,
  normal: 0,
  high: 1,
};

/** Returns a finite number for encodable values, or null for 'unknown'/non-finite (treated as missing). */
export function encodeSignalValue(value: SignalValue): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (value === 'unknown') return null;
  return CATEGORY_ORDINAL[value];
}
