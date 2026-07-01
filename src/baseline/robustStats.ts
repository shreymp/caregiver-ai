/** Median absolute deviation scale factor for approximate normal consistency. */
const MAD_CONSISTENCY_CONSTANT = 1.4826;

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
  }
  return sorted[mid] as number;
}

/** Median absolute deviation around a given center, scaled for normal-consistency. */
export function medianAbsoluteDeviation(values: readonly number[], center: number): number {
  if (values.length === 0) return 0;
  const deviations = values.map((v) => Math.abs(v - center));
  return median(deviations) * MAD_CONSISTENCY_CONSTANT;
}

/** Sequentially folds an EWMA over a chronological series; seeds from the first value. */
export function ewma(values: readonly number[], alpha: number): number {
  if (values.length === 0) return 0;
  let current = values[0] as number;
  for (let i = 1; i < values.length; i += 1) {
    current = alpha * (values[i] as number) + (1 - alpha) * current;
  }
  return current;
}
