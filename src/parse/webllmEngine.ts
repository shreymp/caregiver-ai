import type { MLCEngine } from '@mlc-ai/web-llm';
import type { LlmEngine, LlmLoadProgress } from './llmEngine';

/** Gemma-class ~2B model per CLAUDE.md tech stack note; confirmed present in @mlc-ai/web-llm's prebuiltAppConfig. */
export const DEFAULT_WEBLLM_MODEL_ID = 'gemma-2-2b-it-q4f16_1-MLC';

/** @mlc-ai/web-llm-backed LlmEngine adapter. Only instantiate behind a WebGPU feature-detect (see webgpu.ts). */
export class WebLlmEngine implements LlmEngine {
  private engine: MLCEngine | undefined;
  private readonly modelId: string;

  constructor(modelId: string = DEFAULT_WEBLLM_MODEL_ID) {
    this.modelId = modelId;
  }

  get isLoaded(): boolean {
    return this.engine !== undefined;
  }

  async load(onProgress?: (progress: LlmLoadProgress) => void): Promise<void> {
    // Dynamic import: @mlc-ai/web-llm's runtime is several MB (wasm/tvmjs glue
    // code) and must not be bundled into the main app chunk — it should only
    // ever be fetched when a model is actually being loaded.
    const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
    this.engine = await CreateMLCEngine(this.modelId, {
      initProgressCallback: onProgress
        ? (report) => {
            onProgress({ progress: report.progress, text: report.text });
          }
        : undefined,
    });
  }

  async completeJson(systemPrompt: string, userPrompt: string, jsonSchema: string): Promise<string> {
    if (!this.engine) {
      throw new Error('WebLlmEngine.load() must complete before completeJson() is called.');
    }
    const completion = await this.engine.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object', schema: jsonSchema },
      temperature: 0,
    });
    return completion.choices[0]?.message.content ?? '';
  }

  async unload(): Promise<void> {
    await this.engine?.unload();
    this.engine = undefined;
  }
}
