# PROGRESS — Perception-Assist PWA
_Last updated: 2026-07-01T00:00:00Z by session-1_

## Current step
M8 — Explanation (LLM). explainDeviation() verbalizes a fixed DeviationResult+TierResult via web-llm, with three independent layers keeping it from ever contradicting the tier: (1) 'unsure' always uses UNSURE_EXPLANATION_MESSAGE, never the LLM; (2) malformed/off-schema model JSON falls back to a deterministic template (buildDeterministicFallbackExplanation); (3) well-formed output still runs through checkExplanationConsistentWithTier (keyword-based contradiction check: no escalation/clinician-contact language below its warranted tier, no reassurance language at/above call-tier) and falls back to the template if it fails.

## Next action (resume here)
M5 (tiering) and M11 (Smart 40 harness) remain **BLOCKED on validation/labeling-rubric.md** — still not supplied. Move to M10 next: wire-up + one-screen shell (app.ts) connecting capture -> detect -> tier -> safety -> explain end-to-end, installable PWA. Since M5 doesn't exist yet, M10 will use an explicitly-named placeholder (e.g. `src/tier/pendingRubricStub.ts`) that always returns `unsure` with a reason stating tiering rules aren't configured yet — never a fabricated real tier — so the pipeline can be wired and demoed honestly. Swap this for the real M5 module the moment the rubric arrives; do not let the stub silently become "the" tiering logic. Then M12 (hardening) can proceed since it also doesn't depend on the rubric. Re-run `npm run typecheck` after M10 since app.ts will be the first file importing across nearly every module.

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
- [ ] M10 Wire-up + shell + PWA install
- [ ] M11 Smart 40 harness + metrics
- [ ] M12 Hardening (WebGPU/iOS/a11y)

## Scope cuts (if any)
- none
