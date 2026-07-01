import type { Tier } from '@/types';

/**
 * Deterministic keyword-based check that the LLM's explanation text doesn't
 * contradict the already-decided tier — the explanation may only describe
 * the tier's own reasoning, never suggest a different urgency level
 * (CLAUDE.md guardrail #1: the LLM explains, it never decides). This is a
 * defense-in-depth net on top of prompt instructions, not a substitute for
 * them; callers should fall back to a deterministic template explanation
 * (see fallback.ts) whenever this check fails.
 */
const ESCALATION_LANGUAGE: RegExp[] = [
  /\bemergency\b/i,
  /\b911\b/i,
  /\bambulance\b/i,
  /\burgent(ly)?\b/i,
  /\bescalate\b/i,
  /\bimmediately\b/i,
  /\bright away\b/i,
  /\bwithout delay\b/i,
];

const CLINICIAN_CONTACT_LANGUAGE: RegExp[] = [
  /\bcall (a |the )?(doctor|clinician|nurse|physician|pediatrician)\b/i,
  /\bcontact (a |the )?(clinician|doctor|nurse|physician)\b/i,
  /\bschedule an appointment\b/i,
  /\breach out to (a |the )?(clinician|doctor)\b/i,
];

const REASSURANCE_LANGUAGE: RegExp[] = [
  /\bnothing to worry about\b/i,
  /\bno need to (worry|act|do anything)\b/i,
  /\bnot serious\b/i,
  /\ball(\s*'s| is) (fine|well|normal)\b/i,
  /\bdon'?t need to (call|contact|escalate)\b/i,
];

export interface TierConsistencyCheck {
  consistent: boolean;
  violations: string[];
}

export function checkExplanationConsistentWithTier(tier: Tier, explanation: string): TierConsistencyCheck {
  const violations: string[] = [];
  const hasEscalation = ESCALATION_LANGUAGE.some((pattern) => pattern.test(explanation));
  const hasClinicianContact = CLINICIAN_CONTACT_LANGUAGE.some((pattern) => pattern.test(explanation));
  const hasReassurance = REASSURANCE_LANGUAGE.some((pattern) => pattern.test(explanation));

  if (tier === 'watch' && hasEscalation) {
    violations.push('explanation uses emergency/escalation language for a watch-tier result');
  }
  if (tier === 'watch' && hasClinicianContact) {
    violations.push('explanation suggests contacting a clinician for a watch-tier result');
  }
  if (tier === 'call' && hasEscalation) {
    violations.push('explanation uses emergency/escalation language for a call-tier result');
  }
  if ((tier === 'call' || tier === 'escalate') && hasReassurance) {
    violations.push('explanation downplays a call/escalate-tier result with reassurance language');
  }

  return { consistent: violations.length === 0, violations };
}
