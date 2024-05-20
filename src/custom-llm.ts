/* eslint-disable @typescript-eslint/no-magic-numbers */
import { LLM, type BaseLLMParams } from "@langchain/core/language_models/llms";
import { type CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { GenerationChunk } from "@langchain/core/outputs";
import { type OpenAIClient } from "@langchain/openai";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface UpstashLLMParameters extends BaseLLMParams {
  /** Writer API key */
  apiKey?: string;

  /** Model to use */
  model?: string;

  /** Sampling temperature to use */
  temperature?: number;

  /** Minimum number of tokens to generate. */
  minTokens?: number;

  /** Maximum number of tokens to generate in the completion. */
  maxTokens?: number;

  /** Generates this many completions server-side and returns the "best"." */
  bestOf?: number;

  /** Penalizes repeated tokens according to frequency. */
  frequencyPenalty?: number;

  /** Penalizes repeated tokens regardless of frequency. */
  presencePenalty?: number;

  /** Total probability mass of tokens to consider at each step. */
  topP?: number;
}

export default class UpstashLLM extends LLM {
  temperature = 0.7;

  maxTokens = 256;

  topP = 1;

  frequencyPenalty = 0;

  presencePenalty = 0;

  n = 1;

  model = "mistralai/Mistral-7B-Instruct-v0.2";

  batchSize = 20;

  apiKey: string;

  constructor(fields: UpstashLLMParameters) {
    super({});
    if (!fields.apiKey) {
      throw new Error("apiKey is required");
    }

    this.topP = fields.topP ?? this.topP;
    this.temperature = fields.temperature ?? this.temperature;
    this.maxTokens = fields.maxTokens ?? this.maxTokens;
    this.frequencyPenalty = fields.frequencyPenalty ?? this.frequencyPenalty;
    this.presencePenalty = fields.presencePenalty ?? this.presencePenalty;
    this.model = fields.model ?? this.model;
    this.apiKey = fields.apiKey;
  }

  _llmType() {
    return "Upstash LLM";
  }

  async _call(prompt: string) {
    const url = `${process.env.UPSTASH_MODELS_BACKEND_URL}/v1/completions`;
    const data = {
      prompt: prompt,
      model: this.model,
      max_tokens: this.maxTokens,
      top_p: this.topP,
      temperature: this.temperature,
      frequency_penalty: this.frequencyPenalty,
    };

    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    const object = await response.json();

    const result = object as OpenAIClient.Completions.Completion;

    return result.choices[0].text;
  }

  async *_streamResponseChunks(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    for (const letter of prompt.slice(0, this.n)) {
      yield new GenerationChunk({
        text: letter,
      });

      await runManager?.handleLLMNewToken(letter);
    }
  }
}
