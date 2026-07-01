# PROGRESS — Perception-Assist PWA
_Last updated: 2026-07-01T00:00:00Z by session-1_

## Current step
M12 — Hardening. (1) `getOrLoadEngine` in src/ui/renderApp.ts now catches web-llm load failures, falls back to the deterministic explanation template, and remembers the failure for the rest of the session (no repeated doomed multi-GB download attempts). (2) `importAll()` (src/storage/db.ts) + a "Restore from a backup file" control implement iOS storage re-hydration: re-validates every restored row, recomputes the baseline from restored observations rather than trusting the export's serialized baseline blob. (3) Model-download status text now shows a percentage. (4) Accessibility pass: `aria-live="polite"` on the result region, `role="status"` on status/notice elements, explicit `label[for]`/`id` pairing on every form control (signal selects, note textarea, import file input). `npm run build` verified green throughout.

## Next action (resume here)
This session's autonomous build is at a natural stopping point: **M0-M4, M6-M10, M12 are done; M5 (tiering) and M11 (Smart 40 harness) remain BLOCKED on `validation/labeling-rubric.md`**, which the user has chosen to author themselves (not the agent) per CLAUDE.md guardrail #8. The moment that file is supplied:
1. Write `src/tier/computeTier.ts` (deterministic score/confidence -> watch|call|escalate mapping, thresholds sourced from the rubric) and swap `src/tier/index.ts`'s `computeTier` export to point at it instead of `pendingRubricStub`.
2. Update `src/reason` tier-consistency keyword lists / prompt wording if the rubric's tier names or framing differ from the current watch/call/escalate assumption.
3. Build `validation/run-smart40.ts` (M11): 40 scenarios (28 standard, 4 messy-data, 4 boundary/safety incl. the Protocol 9-Delta case already implemented in src/safety, >=2 HITL instances), compute F1/precision/recall/accuracy, emit pretty-printed logs to `validation/output/`.
4. Only after that: run `npm run typecheck && npm run test && npm run e2e` for the first time this session (tests were written throughout but never executed, per this session's instructions) and fix whatever surfaces.

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
- [x] M12 Hardening (WebGPU/iOS/a11y)

## Scope cuts (if any)
- none
