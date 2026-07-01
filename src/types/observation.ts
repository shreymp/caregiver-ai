/**
 * Canonical signal set, per CLAUDE.md §3. Provisional: names/definitions are
 * finalized by validation/labeling-rubric.md (human-authored) when supplied;
 * do not add clinical meaning to these keys beyond what the rubric defines.
 */
export const SIGNAL_KEYS = [
  'sleep',
  'intake',
  'agitation',
  'bowel',
  'urinary',
  'energy',
  'respiratory',
  'pain',
] as const;

export type SignalKey = (typeof SIGNAL_KEYS)[number];

export type SignalCategory = 'low' | 'normal' | 'high' | 'unknown';

export type SignalValue = number | SignalCategory;

export const SIGNAL_CATEGORIES: readonly SignalCategory[] = ['low', 'normal', 'high', 'unknown'];

export type CaptureSource = 'typed' | 'voice' | 'ocr';

export interface ObservationRecord {
  /** ISO 8601 timestamp of the observation. */
  timestamp: string;
  /** Per-signal values for this observation; not every signal need be present. */
  signals: Partial<Record<SignalKey, SignalValue>>;
  /** Optional free-text caregiver note. */
  note?: string;
  /** Fraction (0..1) of the expected signal set actually present. */
  completeness: number;
  source: CaptureSource;
}
