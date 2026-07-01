export interface LlmLoadProgress {
  /** 0..1 */
  progress: number;
  text: string;
}

/**
 * Adapter interface so the underlying in-browser LLM engine is swappable
 * (CLAUDE.md tech stack note). src/parse and src/reason depend only on this
 * interface, never directly on @mlc-ai/web-llm.
 */
export interface LlmEngine {
  readonly isLoaded: boolean;
  load(onProgress?: (progress: LlmLoadProgress) => void): Promise<void>;
  /**
   * Requests a completion constrained to the given JSON-schema string.
   * Returns raw text — callers must still schema-validate in code
   * (CLAUDE.md guardrail #3); grammar constraints are a defense layer, not
   * a substitute for validation.
   */
  completeJson(systemPrompt: string, userPrompt: string, jsonSchema: string): Promise<string>;
  unload(): Promise<void>;
}
