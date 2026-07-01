# PROGRESS — Perception-Assist PWA
_Last updated: 2026-07-01T00:00:00Z by session-1_

## Current step
M10 — Wire-up + shell + PWA install. src/app.ts (startApp) -> src/ui/renderApp.ts wires capture (typed form, always available) -> storage -> baseline -> detect -> tier (currently `pendingRubricStub`, always 'unsure' pending the rubric) -> safety -> explain (lazy-loads web-llm only if tier isn't 'unsure', which right now it never is) -> one-screen result display with tier/score/explanation and an explicit "act on your own judgment" override note. Data export button wired to exportAllAsJson(). Fixed a real build failure: web-llm's ~6MB runtime was statically bundled into the main chunk and broke the PWA precache step outright — converted to a dynamic import + manualChunks + workbox globIgnores/runtimeCaching so it's fetched on-demand instead (see DECISIONS.md). `npm run build` verified green after the fix.

## Next action (resume here)
M5 (tiering) and M11 (Smart 40 harness) remain **BLOCKED on validation/labeling-rubric.md** — still not supplied. Move to M12 (hardening) next: WebGPU fallback path hardening, iOS storage re-hydration, model-download progress UI polish, accessibility pass. The moment the rubric is supplied, do M5 (real tiering module + swap `src/tier/index.ts`'s `computeTier` export) and M11 (Smart 40 harness) — those are the actual scored artifact and should jump the queue ahead of M12 polish once unblocked.

## Blockers / open questions
- **BLOCKING M5 and M11 (and the tier-referencing parts of M8/M10 UI copy):** `validation/labeling-rubric.md` does not exist. Per CLAUDE.md guardrail #8, thresholds/signal defs/tier definitions must come from this human-authored file — it must NOT be fabricated by the agent. User has been asked and chose to author it themselves (see DECISIONS.md). Building M0-M4, M6, M7, M9-M10 (structure) in the meantime with placeholder/pass-through tier logic clearly marked TODO. Resume M5/M11 as soon as this file is supplied.

## Milestones
- [x] M0  Scaffold
- [x] M1  Types & schema
- [x] M2  Storage
- [x] M3  Baseline
- [x] M4  Detection
- [ ] M5  Tiering
- [x] M6  Safety (incl. Protocol 9-Delta)
- [x] M7  Parse (LLM + WebGPU fallback)
- [x] M8  Explanation (LLM)
- [x] M9  Capture UI (typed, then voice)
- [x] M10 Wire-up + shell + PWA install
- [ ] M11 Smart 40 harness + metrics
- [ ] M12 Hardening (WebGPU/iOS/a11y)

## Scope cuts (if any)
- none
