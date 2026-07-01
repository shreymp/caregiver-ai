import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { _clearAll, _resetDatabaseHandle } from '@/storage';
import { renderApp } from '@/ui/renderApp';

/**
 * Full pipeline, LLM-free happy path: in this environment (no navigator.gpu,
 * and the M5 tier stub always returns 'unsure' pending the labeling rubric),
 * submitting the guaranteed typed form should never need to load web-llm at
 * all — explainDeviation short-circuits on 'unsure' before touching the
 * engine. This proves the wiring end-to-end without needing a real GPU/model
 * download, which is exactly the deterministic core CLAUDE.md prioritizes.
 */
describe('renderApp (M10 wiring, happy path)', () => {
  beforeEach(async () => {
    _resetDatabaseHandle();
    await _clearAll();
  });

  it('renders the capture form, and a typed submission produces a full result block', async () => {
    const root = document.createElement('div');
    await renderApp(root);

    expect(root.querySelector('#signal-sleep')).not.toBeNull();
    expect(root.querySelector('[data-testid="result-section"]')).not.toBeNull();

    const sleepSelect = root.querySelector<HTMLSelectElement>('#signal-sleep');
    if (sleepSelect) sleepSelect.value = 'low';
    const noteInput = root.querySelector<HTMLTextAreaElement>('textarea[name="note"]');
    if (noteInput) noteInput.value = 'Slower to wake up than usual.';

    const form = root.querySelector('form');
    form?.dispatchEvent(new Event('submit', { cancelable: true }));

    // handleSubmission is async (storage + baseline + detect + tier + safety +
    // explain, chained across several fake-indexeddb round trips); poll for
    // the result to appear rather than guessing a fixed number of ticks.
    const deadline = Date.now() + 2000;
    while (!root.querySelector('[data-testid="result-tier"]') && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const tierEl = root.querySelector('[data-testid="result-tier"]');
    const explanationEl = root.querySelector('[data-testid="result-explanation"]');
    const overrideEl = root.querySelector('[data-testid="result-override-note"]');

    expect(tierEl?.textContent).toContain('unsure');
    expect(explanationEl?.textContent?.length ?? 0).toBeGreaterThan(0);
    expect(overrideEl?.textContent).toContain('your own judgment');
  });
});
