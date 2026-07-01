import { describe, expect, it } from 'vitest';
import { renderTypedCaptureForm } from '@/capture/typed/renderTypedCaptureForm';
import type { ValidationResult } from '@/types';

describe('renderTypedCaptureForm', () => {
  it('renders a select for every known signal plus a note field and submit button', () => {
    const container = document.createElement('div');
    renderTypedCaptureForm(container, { onSubmit: () => undefined });

    expect(container.querySelector('#signal-sleep')).not.toBeNull();
    expect(container.querySelector('#signal-pain')).not.toBeNull();
    expect(container.querySelector('textarea[name="note"]')).not.toBeNull();
    expect(container.querySelector('button[type="submit"]')).not.toBeNull();
  });

  it('submits a valid observation built from the selected values', () => {
    const container = document.createElement('div');
    let captured: ValidationResult | undefined;
    renderTypedCaptureForm(container, {
      onSubmit: (result) => {
        captured = result;
      },
    });

    const sleepSelect = container.querySelector<HTMLSelectElement>('#signal-sleep');
    if (sleepSelect) sleepSelect.value = 'low';
    const note = container.querySelector<HTMLTextAreaElement>('textarea[name="note"]');
    if (note) note.value = 'Slower to wake up than usual.';

    const form = container.querySelector('form');
    form?.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(captured?.valid).toBe(true);
    if (captured?.valid) {
      expect(captured.record.signals.sleep).toBe('low');
      expect(captured.record.note).toBe('Slower to wake up than usual.');
    }
  });

  it('submits a zero-completeness but still valid observation when nothing is selected', () => {
    const container = document.createElement('div');
    let captured: ValidationResult | undefined;
    renderTypedCaptureForm(container, {
      onSubmit: (result) => {
        captured = result;
      },
    });

    const form = container.querySelector('form');
    form?.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(captured?.valid).toBe(true);
    if (captured?.valid) expect(captured.record.completeness).toBe(0);
  });
});
