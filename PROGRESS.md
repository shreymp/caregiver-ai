# PROGRESS — Perception-Assist PWA
_Last updated: 2026-07-01T00:00:00Z by session-1_

## Current step
M7 — Parse (LLM). WebGPU feature-detect (getRecommendedCaptureMode) + @mlc-ai/web-llm adapter (LlmEngine interface, swappable) + constrained JSON schema builder + parseObservationText() which schema-validates every model output and never lets off-schema output through. Verified the web-llm API against the actually-installed package's .d.ts (CreateMLCEngine, chat.completions.create, response_format json_object+schema, gemma-2-2b-it-q4f16_1-MLC model id) rather than assuming from memory, per guardrail #10.

## Next action (resume here)
M5 (tiering) and M11 (Smart 40 harness) remain **BLOCKED on validation/labeling-rubric.md** — still not supplied. Move to M9 next (typed capture UI first, then voice) since it doesn't depend on the rubric; M8 (explanation) can follow once there's a DeviationResult+TierResult shape to narrate (M8's non-prescriptive framing doesn't strictly need real tier thresholds to build the LLM explanation plumbing, but final wording review should happen once M5 lands).

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
- [ ] M9  Capture UI (typed, then voice)
- [ ] M10 Wire-up + shell + PWA install
- [ ] M11 Smart 40 harness + metrics
- [ ] M12 Hardening (WebGPU/iOS/a11y)

## Scope cuts (if any)
- none
