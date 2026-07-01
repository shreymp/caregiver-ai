/**
 * Feature-detects WebGPU (CLAUDE.md guardrail #9: never assume it's present).
 * Actually requests an adapter rather than just checking `navigator.gpu`
 * exists, since the property can be present but adapter acquisition can
 * still fail (unsupported GPU, disabled flag, etc).
 */
export async function isWebGpuAvailable(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

export type CaptureMode = 'llm-assisted' | 'typed-structured';

/**
 * Single decision point for the capture UI (M9/M10): when WebGPU isn't
 * available, skip the LLM parse stage entirely and fall back to direct
 * typed structured entry rather than degrading silently.
 */
export async function getRecommendedCaptureMode(): Promise<CaptureMode> {
  return (await isWebGpuAvailable()) ? 'llm-assisted' : 'typed-structured';
}
