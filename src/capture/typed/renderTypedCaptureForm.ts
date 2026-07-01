import { SIGNAL_CATEGORIES, SIGNAL_KEYS, type SignalKey, type SignalValue, type ValidationResult } from '@/types';
import { buildTypedObservation, type TypedCaptureInput } from './typedCapture';

export interface TypedCaptureFormOptions {
  onSubmit: (result: ValidationResult) => void;
}

/**
 * Renders the guaranteed, LLM-free typed capture form (CLAUDE.md M9 "typed
 * first"): a category picker per known signal plus an optional free-text
 * note. Works identically whether or not WebGPU/the LLM is available.
 */
export function renderTypedCaptureForm(container: HTMLElement, options: TypedCaptureFormOptions): void {
  container.innerHTML = '';
  const form = document.createElement('form');
  form.setAttribute('aria-label', 'Record an observation');

  const signalSelects = new Map<SignalKey, HTMLSelectElement>();
  for (const key of SIGNAL_KEYS) {
    const label = document.createElement('label');
    label.textContent = key;

    const select = document.createElement('select');
    select.name = key;
    select.id = `signal-${key}`;

    const unsetOption = document.createElement('option');
    unsetOption.value = '';
    unsetOption.textContent = '(not observed)';
    select.appendChild(unsetOption);

    for (const category of SIGNAL_CATEGORIES) {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    }

    signalSelects.set(key, select);
    label.appendChild(select);
    form.appendChild(label);
  }

  const noteLabel = document.createElement('label');
  noteLabel.textContent = 'Note (optional)';
  const noteInput = document.createElement('textarea');
  noteInput.name = 'note';
  noteLabel.appendChild(noteInput);
  form.appendChild(noteLabel);

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = 'Save observation';
  form.appendChild(submitButton);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const signals: TypedCaptureInput['signals'] = {};
    for (const [key, select] of signalSelects) {
      if (select.value) signals[key] = select.value as SignalValue;
    }
    const result = buildTypedObservation({ signals, note: noteInput.value || undefined });
    options.onSubmit(result);
  });

  container.appendChild(form);
}
