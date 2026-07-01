# SESSION_LOG — Perception-Assist PWA

## 2026-07-01T00:00:00Z
- Resumed at: fresh start (no PROGRESS.md existed)
- Did: read CLAUDE.md; discovered system Node was v16.14.0 (EOL); asked user how to proceed; user chose to upgrade Node. Installed Node 20/24 LTS via `winget install OpenJS.NodeJS.LTS` (resolved to v24.18.0). Created PROGRESS.md, SESSION_LOG.md, DECISIONS.md.
- Decisions: see DECISIONS.md — Node upgraded to v24.18.0 LTS instead of pinning legacy tool versions.
- Tests: typecheck n/a, unit n/a (pre-scaffold)
- Ended at: about to start M0
- Commit: 83e1457

## 2026-07-01T01:00:00Z (same session, continued)
- Resumed at: M0
- Did: built M0 (Vite 6 + TS strict + ESLint 9 flat config + vite-plugin-pwa + Vitest/Playwright configs, guardrail eslint rule blocking detect/tier/safety from importing parse/reason), M1 (types + validateObservation), M2 (IndexedDB storage + export), M3 (baseline: median/MAD/EWMA), M4 (detection: residuals, diagonal-Mahalanobis RMS score, CUSUM changepoint with a clip fix after tracing a single-blip-trips-alone bug, persistence counter), M6 (safety: weak-data + note-conflict HITL paths, Protocol 9-Delta refusal), M7 (parse: web-llm adapter verified against installed .d.ts, WebGPU feature-detect + typed-structured fallback), M9 (capture: typed form guaranteed path, Web Speech voice adapter, OCR stub), M8 (explanation: web-llm verbalizer with 3 layers preventing tier contradiction; refactored to a lazy engine factory), M10 (app.ts/renderApp.ts wiring the full pipeline into a one-screen shell; fixed a real build break from web-llm's 6MB runtime being statically bundled by converting to a dynamic import + manualChunks + workbox exclusion), M12 (WebGPU/model-load fallback handling, importAll() iOS re-hydration + restore UI, download progress %, accessibility pass).
- Also: user was asked whether to draft validation/labeling-rubric.md (unreviewed) or supply it themselves — chose to supply it. **M5 (tiering) and M11 (Smart 40 harness) are BLOCKED on that file per CLAUDE.md guardrail #8** (no fabricated clinical thresholds). Added `src/tier/pendingRubricStub.ts` (aliased as `computeTier`) so M10 could still wire end-to-end honestly — it always returns 'unsure' with a reason naming the missing rubric.
- Decisions: see DECISIONS.md (Node upgrade; rubric ownership; detection method choices; web-llm engine choice; Web Speech for voice; M5 stub during M10; web-llm code-splitting).
- Tests: typecheck pass, lint pass, `npm run build` pass (verified repeatedly after every milestone). Unit/integration/e2e test files were written throughout every milestone but **not executed** per explicit session instructions — first real test run is next session's job.
- Ended at: M0-M4, M6-M10, M12 complete; M5 and M11 blocked on validation/labeling-rubric.md (not yet supplied)
- Commit: 615eeea (HEAD at end of session)
