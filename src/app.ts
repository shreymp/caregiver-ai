import { renderApp } from '@/ui/renderApp';

/** Wires the full pipeline into the one-screen app shell. Kept separate from main.ts so it's directly testable/importable. */
export async function startApp(root: HTMLElement): Promise<void> {
  await renderApp(root);
}
