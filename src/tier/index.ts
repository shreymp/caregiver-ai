export * from './pendingRubricStub';

/**
 * TODO(M5): once validation/labeling-rubric.md is supplied and the real
 * deterministic tiering module is implemented alongside pendingRubricStub,
 * point this alias at it instead. Every other module imports `computeTier`
 * from here, not from pendingRubricStub directly, so this is the only line
 * that needs to change.
 */
export { computePendingTier as computeTier } from './pendingRubricStub';
