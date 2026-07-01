# DECISIONS — Perception-Assist PWA

## 2026-07-01 — Node.js runtime version
- Choice: Upgrade system Node.js from v16.14.0 to v24.18.0 LTS (via `winget install OpenJS.NodeJS.LTS`) rather than pin the whole toolchain to Node-16-compatible package versions.
- Why: Node 16 is EOL (unsupported since Sept 2023). Latest Vite, ESLint, Vitest, and Playwright all require Node 18-20+. Pinning to years-old tool versions for a new competition build would create avoidable technical debt and reduce compatibility with current WebGPU/Transformers.js packages.
- Alternatives considered: pin to Vite 4.x / ESLint 8.x / Vitest 0.34.x / Playwright 1.35.x (all last known Node-16-compatible versions) — rejected because it locks the whole project to an old, unsupported stack for its full lifetime.
- Revisit if: the target deployment/judging environment has a fixed older Node version requirement.

## 2026-07-01 — labeling-rubric.md ownership
- Choice: Asked the user whether to draft `validation/labeling-rubric.md` (flagged unreviewed) or wait for a human-authored one. User chose to author it themselves. M5 (tiering) and M11 (Smart 40 harness/scenarios) are blocked on this file per CLAUDE.md guardrail #8, which explicitly forbids the agent from fabricating clinical thresholds and requires stopping to flag rather than guessing.
- Why: guardrail #8 is a non-negotiable instruction, not a style preference.
- Alternatives considered: agent-authored draft rubric marked unreviewed — user declined this option.
- Revisit if: user supplies `validation/labeling-rubric.md`.

## 2026-07-01 — Detection engine method choices (M4)
- Choice: Multivariate departure = RMS of per-signal standardized residuals (diagonal-covariance Mahalanobis, i.e. no cross-signal correlation term). Changepoint = one-sided CUSUM over the daily score series, with a per-day clip (`scoreClip`, default 2) applied only to the CUSUM accumulator input so a single extreme-magnitude day cannot alone cross the decision threshold. Persistence = simple trailing-run count of days above a generic "elevated" score threshold (default 1.0).
- Why: a full covariance matrix is not statistically estimable from one person's short history (n=1 personal model) — diagonal covariance is the standard, defensible simplification. Plain CUSUM without a clip let a single pathologically extreme day (e.g. residual computed against a near-zero-variability baseline) trip the changepoint alone in testing, which would violate guardrail #6 ("single-day blips do not escalate"); the clip closes that gap while keeping CUSUM's standard sustained-shift detection property intact.
- Alternatives considered: full covariance/Mahalanobis (rejected: unstable with n=1 short history); unclipped CUSUM (rejected: failed the single-blip-must-not-trip guardrail under a stress test with near-zero baseline variability).
- Revisit if: multi-person/pooled baselines are ever introduced (covariance becomes estimable), or the labeling rubric specifies a different persistence/elevated-day definition for tiering purposes (note: the detect-layer `elevatedScoreThreshold` and CUSUM constants here are generic statistical parameters feeding `persistenceDays`/`changepointDetected` as *inputs* to tiering — they are not themselves the clinical action thresholds, which remain owned by M5 + the rubric).

## 2026-07-01 — In-browser LLM engine (M7)
- Choice: @mlc-ai/web-llm as the LLM engine, behind the `LlmEngine` adapter interface (src/parse/llmEngine.ts) so it's swappable per CLAUDE.md. Default model `gemma-2-2b-it-q4f16_1-MLC` (Gemma-class ~2B, matches CLAUDE.md's tech stack note). Verified against the actually-installed package's `.d.ts` files (not assumed from training data, per guardrail #10): `CreateMLCEngine(modelId, engineConfig)`, `engine.chat.completions.create({ messages, response_format: { type: 'json_object', schema }, ... })`, and the model id confirmed present in the package's `prebuiltAppConfig.model_list`.
- Why: web-llm exposes an OpenAI-style `chat.completions.create` API with a `response_format: { type: 'json_object', schema }` grammar-constrained JSON mode, which directly supports the constrained-JSON parse requirement (M7) without hand-rolling grammar constraints. Transformers.js (the alternative named in CLAUDE.md) doesn't have equivalent built-in constrained decoding.
- Alternatives considered: @huggingface/transformers (Transformers.js v4) — viable, but would require building constrained-JSON decoding by hand; not chosen for M7/M8 but the adapter interface keeps it swappable later.
- Revisit if: benchmarking on a real phone (CLAUDE.md's manual device check, M12) shows the 2B model is too slow/heavy; a smaller prebuilt model (e.g. SmolLM2/Qwen3-0.6B, both present in `prebuiltAppConfig`) can be swapped in via the `modelId` constructor argument without touching the adapter interface.

## 2026-07-01 — Voice capture (ASR) engine (M9)
- Choice: Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`) rather than an in-browser Whisper model via Transformers.js.
- Why: zero extra model download, works immediately, and voice is a convenience layer that just fills the same free-text box the LLM-assisted typed flow already parses — it doesn't need on-device-only guarantees as strongly as the observation data itself does (which never leaves the device regardless of ASR choice, since the transcript is processed by the same client-side parse pipeline as any other free text).
- Alternatives considered: Whisper via Transformers.js (WebGPU) — fully on-device even on iOS, but adds a second model download/load path on top of the parse/reason LLM; deferred, the adapter-style `VoiceCaptureAdapter` interface keeps it swappable later.
- Revisit if: iOS testing (CLAUDE.md M12 manual device check) shows Web Speech routes audio off-device in a way that's unacceptable for the privacy guardrail (#7) on that platform — TypeScript's lib.dom.d.ts doesn't ship a `SpeechRecognition` interface at all (only its result sub-types), so a minimal ambient type was hand-declared in src/capture/asr/speechToText.ts.

## 2026-07-01 — M5 stand-in during M10 wire-up
- Choice: Added `src/tier/pendingRubricStub.ts` (aliased as `computeTier` in `src/tier/index.ts`) so M10 could wire the full pipeline end-to-end without the labeling rubric. It always returns `{ tier: 'unsure', reason: '...rubric not supplied...' }` regardless of score — never a fabricated real tier.
- Why: M10 needs *some* TierResult to feed into the safety layer and explanation stage to prove the wiring works; guardrail #8 still forbids guessing at real thresholds. Always-unsure is the only tier value that's honest without the rubric.
- Alternatives considered: skipping M10 entirely until M5 lands — rejected, since CLAUDE.md explicitly lists M10 (wire-up + shell) as building on M1-M9 and the stub keeps the dependency honest and swappable (see the file's own header comment and the TODO in `src/tier/index.ts`).
- Revisit if: never leave this as the shipped behavior — swap the `computeTier` export the moment M5 lands.

## 2026-07-01 — Build pipeline: web-llm code-splitting (M10)
- Choice: Dynamic `import('@mlc-ai/web-llm')` inside `WebLlmEngine.load()` (not a static top-level import), plus a `manualChunks` rule naming it `vendor-webllm` deterministically, plus `workbox.globIgnores` excluding that chunk from service-worker precache (with a `runtimeCaching` CacheFirst rule instead).
- Why: a static import bundled web-llm's ~6MB wasm/tvmjs runtime into the main app chunk, which then failed the PWA build outright (workbox's default 2MB precache limit) and would have forced every visitor to download 6MB before seeing the UI, even on the guaranteed typed-only path that never touches the LLM. After the fix the main chunk is ~20KB and the web-llm runtime is fetched (and cached) only when a model actually loads.
- Alternatives considered: just raising `maximumFileSizeToCacheInBytes` — rejected, it would "fix" the build error but still force-precache 6MB for every install regardless of whether the device ever uses the LLM path.
- Revisit if: model weight files themselves also need explicit runtime-caching rules once M7's actual model download UX is hardened further (M12).

## 2026-07-01 — Build order priority (from CLAUDE.md §6)
- Choice: Build M0-M6 + M11 (typed input path only) as the load-bearing minimum; M7-M10 (LLM parse/explain, voice, UI polish) and M12 (hardening) are valuable but degradable under time pressure.
- Why: CLAUDE.md explicitly states the Smart 40 validation logs are the scored artifact and the deterministic core is what must never be at risk.
- Alternatives considered: build strictly linearly with equal weight on all milestones — rejected per explicit instruction in CLAUDE.md §6.
- Revisit if: scope/priorities change from the user.
