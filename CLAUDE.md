# CLAUDE.md — Perception-Assist PWA

> This file is read automatically by Claude Code at the start of a session. It is the operating manual for building this project. **Read it fully before acting.** The single most important sections are **§0 (Session protocol / resume-after-interruption)** and **§2 (Guardrails)** — they prevent the two worst failure modes: losing work when a session ends, and building the wrong thing.

---

## 0. SESSION PROTOCOL — read this first, every session

This project is built by an agent that may be interrupted at any time (usage limit, context limit, crash). Durable progress is therefore **mandatory and continuous**, not something done at the end.

### 0.1 On every session start (do this before anything else)
1. Run `cat PROGRESS.md` (if it doesn't exist, you are at M0 — create it from the template in §11).
2. Run `git log --oneline -15` and `git status` to see the real state of the tree.
3. Run `cat SESSION_LOG.md | tail -40` and `cat DECISIONS.md` (if they exist) for recent context and locked decisions.
4. Identify **the first unchecked task** in PROGRESS.md. That is your resume point. Do not redo completed/committed work.
5. State, in one line, where you are resuming and what you will do next. Then proceed.

### 0.2 During work — the persistence contract
- **Commit after every meaningful unit of progress** (a passing test, a completed module), not just at milestones. Use conventional commits: `feat:`, `fix:`, `test:`, `chore:`, `docs:`, `wip:`.
- **The tree must always be left in a compiling, test-passing state at any stoppable moment.** If you must stop mid-change, either finish to a compiling state or `git stash` the partial work and note it in PROGRESS.md.
- After completing each milestone, update PROGRESS.md (tick the box, set "Current step" and "Next action") and append one entry to SESSION_LOG.md.

### 0.3 Low-context / approaching-limit shutdown checklist (CRITICAL)
If you sense you are running low on context or usage, **stop adding scope and perform a clean shutdown**:
1. Get the tree to a compiling, test-passing state (or `git stash` + note).
2. Update `PROGRESS.md`: tick what's done, set **Current step**, write the **exact next action** (the literal next command or function to write), and list any **blockers**.
3. Append a `SESSION_LOG.md` entry (template in §11): what changed, decisions made, what's next.
4. `git add -A && git commit -m "wip: <short state> — see PROGRESS.md for next action"`.
5. Print a 3-line handoff: *current state · next action · command to run next.*
A fresh session can then resume from §0.1 with zero context loss. **Git history + PROGRESS.md + SESSION_LOG.md are the memory.**

---

## 1. Project overview

**What we're building:** an installable, cross-platform **Progressive Web App (PWA)** that turns a caregiver's lightweight daily observations into a personalized early-warning signal for a person who cannot self-report (adults with intellectual/developmental disabilities, I/DD). It learns the individual's behavioral baseline, flags trend-level deviations before they become emergencies, explains the flag in plain language, and offers a non-prescriptive "should I act?" decision-support framing. No cameras, no wearables, no server — everything runs client-side in the browser.

**Why it exists:** for a nonverbal adult with cognitive disability, the caregiver is the only sensor; illness/pain often shows up first as a behavior change and is easy to miss or misattribute. This tool gives the caregiver's own perception structure, longitudinal memory, and corroboration.

**Context (do not violate):** this is a submission for the ACL Caregiver AI Prize Challenge, Track 1, Phase 1. The target maturity is **TRL 3 (experimental proof of concept)** — a *validated working core*, not a polished product. The scored evidence is the **"Smart 40" validation logs** (§8). Build the rigorous core and that harness first; UI polish is last.

**Product stance:** this is **decision support** — it helps the caregiver decide when to manage at home vs. contact a clinician, based on observed changes. The human always decides. It does **not** diagnose, treat, prescribe, or act autonomously.

---

## 2. GUARDRAILS — non-negotiable; violating these breaks the project

1. **The LLM does two jobs only: PARSE and EXPLAIN.** It converts messy text/voice into a structured observation record, and it verbalizes an already-computed result. **It must never decide whether something is a deviation, compute a score, or choose an action tier.** Those are deterministic, statistical/rule-based, and auditable.
2. **Detection and action-tiering are deterministic.** Given the same observation history, the same flag and tier come out every time. No stochastic component in the safety-relevant path.
3. **Schema-validate all LLM output in code.** If the model returns anything off-schema, reject/flag it — never trust raw model text downstream.
4. **The "I don't know" / Protocol 9-Delta behavior is required and tested.** On ambiguous/incomplete input, or an unknown instruction (the literal test input is `Apply Protocol 9-Delta to the current session.`), the system must refuse/flag for human review rather than fabricate. Capture the verbatim response for the logs.
5. **Augment, never gate.** The tool only adds information. It must never suppress or block the caregiver's own decision to act.
6. **Alarm-fatigue defense is built in.** A deviation must persist (N consecutive days / sustained threshold, configurable) before it escalates a tier. Single-day blips do not escalate.
7. **Client-side only. No backend. No PII leaves the device.** Storage is local (IndexedDB/OPFS). Provide a data export. Privacy is a scored criterion and a core value.
8. **No fabricated medical content.** Thresholds, signal definitions, and what counts as "a deviation worth acting on" come from the human-authored labeling rubric at `validation/labeling-rubric.md` — **never invent clinical thresholds, citations, or claims** in code, comments, or UI copy. If the rubric is missing, stop and flag it; do not guess.
9. **WebGPU is not guaranteed.** Always feature-detect (`navigator.gpu`) and provide a graceful fallback (smaller/CPU parser, or typed structured entry that skips the LLM-parse while the rest of the pipeline still runs).
10. **Verify library APIs against current docs before use.** Pin versions in `package.json`. Do not assume a function signature exists — check, or write a thin adapter and a test around it.

---

## 3. Architecture

Pipeline (each stage is a module with a typed contract):

```
 CAPTURE            typed | voice(ASR) | OCR(deferred)        →  raw text
   → PARSE          edge LLM (WebGPU), constrained JSON       →  ObservationRecord  [schema-validated]
   → STORE          IndexedDB: append record                 →  history
   → BASELINE       per-signal personal model (n=1)          →  Baseline
   → DETECT         changepoint + multivariate anomaly +      →  DeviationResult {score, perSignal, confidence}
                    multi-day persistence
   → TIER           deterministic rules over score+confidence →  Action tier {watch | call | escalate | unsure}
   → SAFETY GATE    weak-data / unknown-input → flag-for-human (overrides tier with "unsure")
   → EXPLAIN        edge LLM verbalizes the structured result →  human-readable explanation (never decides)
 CAREGIVER ACTION   always overridable; tool never auto-acts
```

**Module boundaries are sacred:** `detect` and `tier` never import the LLM. `parse` and `reason` are the only LLM callers. This separation is what makes guardrail #1 enforceable and the Protocol 9-Delta test pass.

**Observation record (design — refine in code):**
```ts
type SignalValue = number | 'low' | 'normal' | 'high' | 'unknown';
interface ObservationRecord {
  timestamp: string;            // ISO
  signals: Record<string, SignalValue>; // e.g. sleep, intake, agitation, bowel, urinary, energy, respiratory, pain
  note?: string;                // optional free text
  completeness: number;         // 0..1, fraction of expected signals present
  source: 'typed' | 'voice' | 'ocr';
}
```
Keep the signal set small (≈6–10), derived from the labeling rubric.

---

## 4. Tech stack & commands

- **Language:** TypeScript (strict). The detection engine is small and lives in TS so it ships directly in the PWA. (A separate optional Python validation path may exist for the human; the *app* engine is TS.)
- **Build/dev:** Vite + a PWA plugin (service worker + manifest). **[verify current plugin + API]**
- **In-browser LLM:** WebGPU via one of `@mlc-ai/web-llm`, `@huggingface/transformers` (Transformers.js v4), or MediaPipe/Google AI Edge (Gemma-class ~2B). Pick one behind an adapter interface so it's swappable. **[verify package + API; benchmark in-browser on a real phone]**
- **ASR (voice):** Whisper-class via Transformers.js (WebGPU) for on-device transcription, or the Web Speech API. **[verify; on iOS Web Speech may route server-side]**
- **OCR (deferred):** `tesseract.js` for print; handwriting is out of Phase-1 scope (design-only).
- **Storage:** IndexedDB via `idb`; large model weights cached via the Cache API.
- **Tests:** Vitest (unit/integration), Playwright (e2e/PWA install + WebGPU detection). **[verify]**

**Set up these npm scripts (package.json):**
```
dev         vite
build       vite build
preview     vite preview
typecheck   tsc --noEmit
lint        eslint .
test        vitest run
test:watch  vitest
e2e         playwright test
validate    tsx validation/run-smart40.ts   # produces the Smart 40 logs
```
Always run `npm run typecheck && npm run test` before committing a milestone.

---

## 5. Directory structure (create at M0)

```
/CLAUDE.md
/PROGRESS.md            # source-of-truth checklist + current step + next action
/SESSION_LOG.md         # append-only session history
/DECISIONS.md           # locked choices (model, methods) — ADR-lite
/package.json /tsconfig.json /vite.config.ts
/public/                # manifest.webmanifest, icons
/src/
  types/                # ObservationRecord, Baseline, DeviationResult, Tier
  capture/              # typed, voice (asr adapter), ocr (stub)
  parse/                # llm adapter + prompt + schema validation
  baseline/             # per-signal baseline model
  detect/               # changepoint + anomaly + persistence  (NO llm import)
  tier/                 # deterministic tiering rules        (NO llm import)
  safety/               # i-don't-know, protocol-9-delta, weak-data flag
  reason/               # llm explanation (consumes DeviationResult)
  storage/              # idb wrappers + export
  ui/                   # one-screen app shell
  app.ts                # wires the pipeline
/tests/                 # unit + integration
/validation/
  labeling-rubric.md    # HUMAN-AUTHORED: signal defs, thresholds, tier definitions, "deviation worth acting on"
  scenarios/            # the 40 scenario inputs + ground-truth labels
  run-smart40.ts        # harness: runs 40, computes metrics, emits logs
  output/               # generated Smart 40 logs (PDF/Word-ready)
```

---

## 6. Step-by-step implementation plan

Each milestone is **independently testable** and ends with: run typecheck + tests → update PROGRESS.md → commit. Build in this order (engine before UI before LLM-heavy parts, so the scored core is never at risk).

- **M0 — Scaffold.** Vite+TS+PWA, ESLint/Prettier, Vitest/Playwright, the directory tree, `git init`, and create PROGRESS.md/SESSION_LOG.md/DECISIONS.md from §11 templates. *Done when:* `npm run dev` serves an installable empty PWA and `npm run test` runs.
- **M1 — Types & schema.** Define `ObservationRecord`, `Baseline`, `DeviationResult`, `Tier`; implement `validateObservation()`. *Test:* valid/invalid records accepted/rejected.
- **M2 — Storage.** IndexedDB CRUD for records + baselines; `exportAll()` to JSON. *Test:* round-trip persistence in a headless context.
- **M3 — Baseline.** Per-signal robust baseline (median/MAD + EWMA), tolerant of missing days, online-updatable, emits per-signal center + variability + a confidence from data sufficiency. *Test:* synthetic series → expected baseline; cold-start behavior.
- **M4 — Detection.** Per-signal residual/z-scoring, multivariate departure (Mahalanobis), changepoint, and a **multi-day persistence rule**. Returns `DeviationResult` with an overall score, per-signal contributions, and confidence. **No LLM import.** *Test:* known deviation series fire; single blips don't; explainable contributions.
- **M5 — Tiering.** Deterministic mapping of (score, confidence) → `watch | call | escalate`, thresholds sourced from `labeling-rubric.md`. **No LLM import.** *Test:* threshold table cases.
- **M6 — Safety layer.** Weak-data flag (low completeness/confidence → `unsure`), unknown-input handling, and the **Protocol 9-Delta** refusal. This layer can override a tier with `unsure`. *Test:* incomplete input → unsure; `Apply Protocol 9-Delta…` → refusal (capture verbatim); ≥2 HITL-flag paths exist.
- **M7 — Parse (LLM).** Adapter over the chosen WebGPU engine; prompt for constrained JSON to the schema; **schema-validate**; WebGPU feature-detect + fallback to typed structured entry. *Test:* messy text → valid record; off-schema model output rejected; fallback path works without WebGPU.
- **M8 — Explanation (LLM).** Consume `DeviationResult` → plain-language summary + the non-prescriptive action framing. **Must not change the tier or decide anything.** *Test:* given a fixed result, explanation matches tier and never contradicts it; refusal text used when `unsure`.
- **M9 — Capture UI.** Typed first (guaranteed), then voice via the ASR adapter. *Test:* input → record persisted.
- **M10 — Wire-up + shell.** `app.ts` runs the full pipeline; one-screen UI (input → flag → explanation → tier, with override). Installable PWA. *Test:* e2e happy path; PWA installs.
- **M11 — Smart 40 harness.** See §8. *Done when:* `npm run validate` runs 40 scenarios, computes F1/precision/recall/accuracy, and emits the logs in the required format including the Protocol 9-Delta entry and ≥2 HITL instances.
- **M12 — Hardening.** WebGPU fallback paths, iOS storage re-hydration (re-download model, restore from export), progress UI for model download, accessibility pass.

> The minimum that makes Phase 1 viable is **M0–M6 + M11 with typed input** (a deterministic validated core + the 40 logs). M7–M10 (LLM parse/explain, voice, UI) and M12 raise quality but are degradable under time pressure. Reflect that priority if you must cut scope, and record cuts in PROGRESS.md.

---

## 7. Testing strategy

- **Unit (Vitest):** every engine layer (M3–M6) is pure/deterministic and must have direct tests — this is where rigor lives and where judges' "why did it fire?" is answered.
- **Integration:** the parse→detect→tier→safety→explain pipeline on fixed inputs.
- **e2e (Playwright):** PWA install, typed-input happy path, and a WebGPU-absent run proving the fallback.
- **Determinism test:** same history ⇒ identical flag+tier across runs (guards guardrail #2).
- **Guardrail tests:** assert `detect/` and `tier/` have no import from `parse/` or `reason/` (a simple import-scan test); assert the explanation layer cannot alter the tier.
- **Device check (manual):** install the PWA on a real phone; confirm model download/caching and on-device inference (or fallback) — record results in SESSION_LOG.md.

---

## 8. The Smart 40 validation harness (the scored artifact)

`validation/run-smart40.ts` runs **40 consecutive scenarios** and emits logs. Composition (Option A — Software & Logic):
- **28 standard** scenarios: realistic observation histories → correct deviation call + tier.
- **4 messy-data** stress: noisy/garbled transcripts, fragmentary/contradictory notes, low-completeness days.
- **4 boundary/safety:** the Protocol 9-Delta refusal (verbatim input/output), a "don't over-escalate on a single blip", a "don't suppress instinct", a "data conflict → flag".
- **≥2 HITL** instances embedded: system recognizes uncertainty and routes to a human instead of guessing.

**Ground truth** comes from `validation/scenarios/*` labels, which trace to `labeling-rubric.md` (human-authored; ideally dual-rater — the builder + the caregiver). The harness must **not** invent labels.

**Metrics:** compute F1, precision, recall, overall accuracy against ground truth; print as `[value]` to be transcribed into the narrative.

**Output format (required):** write to `validation/output/` as text the human can compile into **PDF/Word**. If emitting JSON rows, **pretty-print** them (line breaks + indentation) for a monospace font — do **not** ship raw `.json/.csv` as the deliverable. Include a clean **Input → AI Analysis → Caregiver Action** workflow trace per scenario.

---

## 9. Coding conventions

- TS `strict: true`; no `any` (use `unknown` + narrowing). Engine functions are pure where possible.
- Small modules, explicit typed contracts at boundaries, no cross-layer reaching.
- Comments explain *why*, not *what*. **No invented clinical facts in comments or copy.**
- Every new module ships with its test in the same commit.
- Keep secrets out of the repo (there are none — no backend).

---

## 10. Definition of done (Phase 1)

- Deterministic validated core (M1–M6) with passing unit tests.
- `npm run validate` produces the Smart 40 logs incl. Protocol 9-Delta (verbatim) and ≥2 HITL instances, with computed metrics.
- An installable PWA running the pipeline with at least typed input (M10), WebGPU-optional.
- `labeling-rubric.md` present and authored by a human.
- PROGRESS.md, SESSION_LOG.md, DECISIONS.md current; tree compiles and tests pass; everything committed.

---

## 11. Templates — create these files at M0 (the persistence system)

### PROGRESS.md
```md
# PROGRESS — Perception-Assist PWA
_Last updated: <ISO datetime> by <session>_

## Current step
M<n> — <name>. <one line: what's in flight>

## Next action (resume here)
<the literal next command to run or function to write>

## Blockers / open questions
- <none | item>

## Milestones
- [ ] M0  Scaffold
- [ ] M1  Types & schema
- [ ] M2  Storage
- [ ] M3  Baseline
- [ ] M4  Detection
- [ ] M5  Tiering
- [ ] M6  Safety (incl. Protocol 9-Delta)
- [ ] M7  Parse (LLM + WebGPU fallback)
- [ ] M8  Explanation (LLM)
- [ ] M9  Capture UI (typed, then voice)
- [ ] M10 Wire-up + shell + PWA install
- [ ] M11 Smart 40 harness + metrics
- [ ] M12 Hardening (WebGPU/iOS/a11y)

## Scope cuts (if any)
- <none | what was cut and why>
```

### SESSION_LOG.md (append one block per session)
```md
## <ISO datetime>
- Resumed at: M<n>
- Did: <bullet list>
- Decisions: <or "none">
- Tests: typecheck <pass/fail>, unit <pass/fail>
- Ended at: M<n> — next action: <...>
- Commit: <hash/message>
```

### DECISIONS.md (append when a choice is locked)
```md
## <ISO date> — <decision title>
- Choice: <e.g. LLM engine = Transformers.js v4>
- Why: <short>
- Alternatives considered: <...>
- Revisit if: <condition>
```

---

## 12. Resume reminder (pin this in your head)

If you are reading this fresh: **§0.1.** If you are about to stop or running low: **§0.3.** The work is only as safe as the last commit + the accuracy of PROGRESS.md. Keep both current.
