export interface CusumOptions {
  /** Slack (reference) value subtracted from each score before accumulating. Standard SPC default. */
  slack?: number;
  /** Decision threshold h; cumulative sum above this signals a sustained upward shift. Standard SPC default. */
  thresholdH?: number;
  /**
   * Per-day cap applied to each score before it feeds the CUSUM accumulator
   * (does not affect the reported score/contributions elsewhere — only this
   * accumulator). Without this cap, one arbitrarily extreme single day could
   * alone cross `thresholdH` in a single step, defeating the "single blips
   * don't escalate" guardrail (CLAUDE.md #6). Capped, at least two elevated
   * days in a row are required to trip the default threshold.
   */
  scoreClip?: number;
}

const DEFAULT_CUSUM: Required<CusumOptions> = { slack: 0.5, thresholdH: 4, scoreClip: 2 };

export interface ChangepointResult {
  changepointDetected: boolean;
  cusum: number;
}

/**
 * One-sided CUSUM (cumulative sum control chart) over a chronological score
 * series. Detects a sustained upward shift in the series level as of the
 * most recent point — a single high-scoring blip decays back toward 0 and
 * will not trip the threshold, but a sustained shift accumulates past it.
 * `slack`/`thresholdH` are standard statistical-process-control tuning
 * constants (not clinical thresholds) tuned to flag a roughly 1-sigma
 * sustained shift at a low false-alarm rate.
 */
export function detectChangepoint(
  scores: readonly number[],
  options: CusumOptions = {}
): ChangepointResult {
  const { slack, thresholdH, scoreClip } = { ...DEFAULT_CUSUM, ...options };
  let cusum = 0;
  for (const s of scores) {
    const clipped = Math.min(s, scoreClip);
    cusum = Math.max(0, cusum + (clipped - slack));
  }
  return { changepointDetected: cusum > thresholdH, cusum };
}
