/** Constrained JSON schema for the explanation-stage LLM: a single plain-text field, nothing else. */
export function buildExplanationJsonSchema(): string {
  return JSON.stringify({
    type: 'object',
    properties: { explanation: { type: 'string' } },
    required: ['explanation'],
    additionalProperties: false,
  });
}
