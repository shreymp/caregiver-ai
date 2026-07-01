/**
 * OCR capture is explicitly deferred per CLAUDE.md §1/§6 ("OCR (deferred);
 * handwriting is out of Phase-1 scope (design-only)"). This stub exists so
 * the capture/ directory matches CLAUDE.md §5 and gives future work a typed
 * extension point — it is not wired into any UI in Phase 1, and must not be
 * presented to the caregiver as a working feature.
 */
export interface OcrCaptureResult {
  supported: false;
  reason: string;
}

export function captureFromImage(_imageData: Blob): Promise<OcrCaptureResult> {
  return Promise.resolve({
    supported: false,
    reason: 'OCR capture is deferred beyond Phase 1 (CLAUDE.md §6) and is not implemented.',
  });
}
