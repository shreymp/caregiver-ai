/**
 * Fixed, non-LLM message used whenever the tier is 'unsure' (safety-layer
 * override). Guardrail #4-style: in the most safety-critical state, the
 * explanation is deterministic and auditable, never model-generated.
 */
export const UNSURE_EXPLANATION_MESSAGE =
  "There isn't enough reliable information yet to characterize today's observation with confidence, so this has been set aside for you to review directly rather than summarized automatically. Consider whether the note and your own sense of the day agree, and whether reaching out to a clinician or another support person makes sense — regardless of what any automated summary would say.";
