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

## 2026-07-01 — Build order priority (from CLAUDE.md §6)
- Choice: Build M0-M6 + M11 (typed input path only) as the load-bearing minimum; M7-M10 (LLM parse/explain, voice, UI polish) and M12 (hardening) are valuable but degradable under time pressure.
- Why: CLAUDE.md explicitly states the Smart 40 validation logs are the scored artifact and the deterministic core is what must never be at risk.
- Alternatives considered: build strictly linearly with equal weight on all milestones — rejected per explicit instruction in CLAUDE.md §6.
- Revisit if: scope/priorities change from the user.
