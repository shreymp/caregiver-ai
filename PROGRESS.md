# PROGRESS — Perception-Assist PWA
_Last updated: 2026-07-01T00:00:00Z by session-1_

## Current step
M6 — Safety layer. Weak-data HITL path (low completeness/confidence), note-vs-signal-conflict HITL path (2 distinct flag routes), and Protocol 9-Delta / unknown-instruction refusal (deterministic pattern match, verbatim capture). applySafetyLayer() overrides a TierResult to 'unsure' when flagged, otherwise passes it through unchanged — never escalates/de-escalates on its own. Extended the M0 ESLint guardrail to also block safety/ from importing parse/ or reason/.

## Next action (resume here)
M5 (tiering) and M11 (Smart 40 harness) remain **BLOCKED on validation/labeling-rubric.md** — still not supplied. Skip ahead to M7 (parse/LLM adapter with WebGPU feature-detect + fallback) next, since it doesn't depend on the rubric.

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
- [ ] M7  Parse (LLM + WebGPU fallback)
- [ ] M8  Explanation (LLM)
- [ ] M9  Capture UI (typed, then voice)
- [ ] M10 Wire-up + shell + PWA install
- [ ] M11 Smart 40 harness + metrics
- [ ] M12 Hardening (WebGPU/iOS/a11y)

## Scope cuts (if any)
- none
