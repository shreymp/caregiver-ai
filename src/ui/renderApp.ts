import { updateBaseline } from '@/baseline';
import { renderTypedCaptureForm } from '@/capture/typed/renderTypedCaptureForm';
import { submitObservation } from '@/capture/submit';
import { computeDeviation } from '@/detect';
import type { LlmEngine } from '@/parse/llmEngine';
import { getRecommendedCaptureMode } from '@/parse/webgpu';
import { WebLlmEngine } from '@/parse/webllmEngine';
import { explainDeviation, type ExplanationResult } from '@/reason';
import { applySafetyLayer } from '@/safety';
import { getAllObservations, exportAllAsJson, setBaseline } from '@/storage';
import { computeTier } from '@/tier';
import type { DeviationResult, TierResult, ValidationResult } from '@/types';

let cachedEngine: LlmEngine | undefined;

/** Loads the web-llm engine only on first actual need — never eagerly, since it's a multi-GB download. */
async function getOrLoadEngine(onProgress?: (text: string) => void): Promise<LlmEngine> {
  cachedEngine ??= await (async () => {
    const engine = new WebLlmEngine();
    await engine.load((progress) => onProgress?.(progress.text));
    return engine;
  })();
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

/** One-screen app shell (M10): input -> flag -> explanation -> tier, with an explicit override note. */
export async function renderApp(root: HTMLElement): Promise<void> {
  root.innerHTML = '';

  const heading = document.createElement('h1');
  heading.textContent = 'Perception-Assist';
  root.appendChild(heading);

  const modeNotice = document.createElement('p');
  modeNotice.dataset.testid = 'capture-mode';
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
  resultSection.dataset.testid = 'result-section';
  root.appendChild(resultSection);

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.textContent = 'Export my data';
  exportButton.addEventListener('click', () => {
    void exportAllAsJson().then((json) =>
      triggerJsonDownload(`perception-assist-export-${Date.now()}.json`, json)
    );
  });
  root.appendChild(exportButton);

  renderTypedCaptureForm(captureSection, {
    onSubmit: (result) => {
      void handleSubmission(result, resultSection);
    },
  });
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
  const explanation = await explainDeviation(
    () =>
      getOrLoadEngine((text) => {
        statusEl.textContent = text;
      }),
    deviation,
    finalTier
  );

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
