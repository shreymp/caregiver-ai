# PROGRESS — Perception-Assist PWA
_Last updated: 2026-07-01T00:00:00Z by session-1_

## Current step
M9 — Capture UI. Guaranteed typed path: renderTypedCaptureForm (category picker per signal + free-text note, no LLM dependency) -> buildTypedObservation -> submitObservation (persists via M2 storage). Voice: WebSpeechVoiceCaptureAdapter (Web Speech API, feature-detected) transcribes into the same free-text note field, which — when WebGPU is available — can additionally be run through M7's parseObservationText for LLM-assisted signal extraction. OCR stub present per CLAUDE.md's explicit Phase-1 deferral.

## Next action (resume here)
M5 (tiering) and M11 (Smart 40 harness) remain **BLOCKED on validation/labeling-rubric.md** — still not supplied. Move to M8 (explanation/LLM) next: consume a DeviationResult + TierResult and produce a plain-language, non-prescriptive explanation that never alters the tier. Then M10 (wire-up + one-screen shell) to connect capture -> detect -> [tier stubbed until rubric arrives] -> safety -> explain end-to-end.

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
- [ ] M8  Explanation (LLM)
- [x] M9  Capture UI (typed, then voice)
- [ ] M10 Wire-up + shell + PWA install
- [ ] M11 Smart 40 harness + metrics
- [ ] M12 Hardening (WebGPU/iOS/a11y)

## Scope cuts (if any)
- none
