import { updateBaseline } from '@/baseline';
import { renderTypedCaptureForm } from '@/capture/typed/renderTypedCaptureForm';
import { submitObservation } from '@/capture/submit';
import { computeDeviation } from '@/detect';
import type { LlmEngine, LlmLoadProgress } from '@/parse/llmEngine';
import { getRecommendedCaptureMode } from '@/parse/webgpu';
import { WebLlmEngine } from '@/parse/webllmEngine';
import { buildDeterministicFallbackExplanation, explainDeviation, type ExplanationResult } from '@/reason';
import { applySafetyLayer } from '@/safety';
import { exportAllAsJson, getAllObservations, importAll, setBaseline } from '@/storage';
import { computeTier } from '@/tier';
import type { DeviationResult, TierResult, ValidationResult } from '@/types';

let cachedEngine: LlmEngine | undefined;
let engineLoadFailed = false;

/**
 * Loads the web-llm engine only on first actual need — never eagerly, since
 * it's a multi-GB download. If loading ever fails (OOM, adapter lost, no
 * network for first download, etc — CLAUDE.md guardrail #9: WebGPU/model
 * availability is never guaranteed), remembers that and stops retrying for
 * the rest of this session so the caregiver isn't stuck retrying a doomed
 * download on every submission; callers fall back to the deterministic
 * explanation template instead (see handleSubmission).
 */
async function getOrLoadEngine(onProgress?: (progress: LlmLoadProgress) => void): Promise<LlmEngine> {
  if (engineLoadFailed) {
    throw new Error('On-device assistant is unavailable this session (a previous load attempt failed).');
  }
  if (!cachedEngine) {
    const engine = new WebLlmEngine();
    try {
      await engine.load(onProgress);
    } catch (error) {
      engineLoadFailed = true;
      throw error;
    }
    cachedEngine = engine;
  }
  return cachedEngine;
}

function triggerJsonDownload(filename: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsText(file);
  });
}

/** One-screen app shell (M10): input -> flag -> explanation -> tier, with an explicit override note. */
export async function renderApp(root: HTMLElement): Promise<void> {
  root.innerHTML = '';
  root.setAttribute('lang', 'en');

  const heading = document.createElement('h1');
  heading.textContent = 'Perception-Assist';
  root.appendChild(heading);

  const modeNotice = document.createElement('p');
  modeNotice.dataset.testid = 'capture-mode';
  modeNotice.setAttribute('role', 'status');
  modeNotice.textContent = 'Checking device capabilities…';
  root.appendChild(modeNotice);
  void getRecommendedCaptureMode().then((mode) => {
    modeNotice.textContent =
      mode === 'llm-assisted'
        ? 'On-device assistant available for free-text notes.'
        : 'Structured entry mode (on-device assistant unavailable on this device).';
  });

  const captureSection = document.createElement('section');
  captureSection.setAttribute('aria-label', 'Record an observation');
  root.appendChild(captureSection);

  const resultSection = document.createElement('section');
  resultSection.setAttribute('aria-label', 'Result');
  resultSection.setAttribute('aria-live', 'polite');
  resultSection.dataset.testid = 'result-section';
  root.appendChild(resultSection);

  const dataSection = document.createElement('section');
  dataSection.setAttribute('aria-label', 'Your data');
  root.appendChild(dataSection);

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.textContent = 'Export my data';
  exportButton.addEventListener('click', () => {
    void exportAllAsJson().then((json) =>
      triggerJsonDownload(`perception-assist-export-${Date.now()}.json`, json)
    );
  });
  dataSection.appendChild(exportButton);

  const importLabel = document.createElement('label');
  importLabel.textContent = 'Restore from a backup file';
  importLabel.setAttribute('for', 'import-backup-input');
  dataSection.appendChild(importLabel);

  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.id = 'import-backup-input';
  importInput.accept = 'application/json';
  dataSection.appendChild(importInput);

  const importStatus = document.createElement('p');
  importStatus.dataset.testid = 'import-status';
  importStatus.setAttribute('role', 'status');
  dataSection.appendChild(importStatus);

  importInput.addEventListener('change', () => {
    const file = importInput.files?.[0];
    if (!file) return;
    void handleImport(file, importStatus);
  });

  renderTypedCaptureForm(captureSection, {
    onSubmit: (result) => {
      void handleSubmission(result, resultSection);
    },
  });
}

/** iOS storage re-hydration path (CLAUDE.md M12): restores observations + a recomputed baseline from a previously exported JSON file. */
async function handleImport(file: File, statusEl: HTMLElement): Promise<void> {
  statusEl.textContent = 'Restoring…';
  try {
    const text = await readFileAsText(file);
    const payload: unknown = JSON.parse(text);
    const result = await importAll(payload);
    statusEl.textContent =
      result.rejectedObservations > 0
        ? `Restored ${result.importedObservations} observation(s); skipped ${result.rejectedObservations} that didn't match the expected format.`
        : `Restored ${result.importedObservations} observation(s).`;
  } catch {
    statusEl.textContent = 'Could not restore from that file — it may not be a valid Perception-Assist export.';
  }
}

async function handleSubmission(result: ValidationResult, resultSection: HTMLElement): Promise<void> {
  resultSection.innerHTML = '';

  if (!result.valid) {
    const errorEl = document.createElement('p');
    errorEl.dataset.testid = 'result-error';
    errorEl.textContent = `Could not save this entry: ${result.errors.join('; ')}`;
    resultSection.appendChild(errorEl);
    return;
  }

  const statusEl = document.createElement('p');
  statusEl.dataset.testid = 'result-status';
  statusEl.setAttribute('role', 'status');
  statusEl.textContent = 'Saving…';
  resultSection.appendChild(statusEl);

  await submitObservation(result.record);
  const history = await getAllObservations();
  const baseline = updateBaseline(history);
  await setBaseline(baseline);

  const deviation = computeDeviation(history, baseline);
  const tier = computeTier(deviation);
  const finalTier = applySafetyLayer({ observation: result.record, deviation, tier });

  statusEl.textContent = 'Preparing explanation…';
  let explanation: ExplanationResult;
  try {
    explanation = await explainDeviation(
      () =>
        getOrLoadEngine((progress) => {
          statusEl.textContent = `Loading on-device assistant… ${Math.round(progress.progress * 100)}% (${progress.text})`;
        }),
      deviation,
      finalTier
    );
  } catch {
    // Guardrail #9: WebGPU/model availability is never guaranteed — fall back
    // to the same deterministic template used for off-schema model output,
    // rather than leaving the caregiver stuck on a failed load.
    explanation = { explanation: buildDeterministicFallbackExplanation(deviation, finalTier), usedFallback: true };
  }

  renderResult(resultSection, deviation, finalTier, explanation);
}

function renderResult(
  resultSection: HTMLElement,
  deviation: DeviationResult,
  tier: TierResult,
  explanation: ExplanationResult
): void {
  resultSection.innerHTML = '';

  const tierEl = document.createElement('p');
  tierEl.dataset.testid = 'result-tier';
  tierEl.textContent = `Tier: ${tier.tier}`;
  resultSection.appendChild(tierEl);

  const scoreEl = document.createElement('p');
  scoreEl.dataset.testid = 'result-score';
  scoreEl.textContent = `Deviation score: ${deviation.score.toFixed(2)} (confidence ${(deviation.confidence * 100).toFixed(0)}%)`;
  resultSection.appendChild(scoreEl);

  const explanationEl = document.createElement('p');
  explanationEl.dataset.testid = 'result-explanation';
  explanationEl.textContent = explanation.explanation;
  resultSection.appendChild(explanationEl);

  const overrideNote = document.createElement('p');
  overrideNote.dataset.testid = 'result-override-note';
  overrideNote.textContent =
    'This is decision support only — you can always act on your own judgment regardless of this result.';
  resultSection.appendChild(overrideNote);
}
