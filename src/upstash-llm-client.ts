import { ChatOpenAI } from "@langchain/openai";
import { type BaseMessage } from "@langchain/core/messages";
export type LLMType = "mistralai/Mistral-7B-Instruct" | "meta-llama/Meta-Llama-3-8B-Instruct";
import { type ChatGeneration } from "@langchain/core/outputs";

export type UpstashLLMClientConfig = {
  model: LLMType;
  apiKey: string;
  streaming: boolean;
  maxTokens?: number;
  topP?: number;
  temperature?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  n?: number;
};

export class UpstashLLMClient extends ChatOpenAI {
  modelName: LLMType;

  apiKey: string;

  maxTokens?: number;

  temperature = 1;

  n = 1;

  streaming = false;

  topP = 1;

  frequencyPenalty = 0;

  presencePenalty = 0;

  constructor(config: UpstashLLMClientConfig) {
    super(
      {
        modelName: config.model,
        apiKey: config.apiKey,
        maxTokens: config.maxTokens,
        streaming: config.streaming,
        // topP: config.topP,
        // temperature: config.temperature,
        // n: config.n,
        // frequencyPenalty: config.frequencyPenalty,
        // presencePenalty: config.presencePenalty,
      },
      {
        baseURL: "https://qstash.upstash.io/llm/v1",
      }
    );

    this.modelName = config.model;
    this.apiKey = config.apiKey;
    this.maxTokens = config.maxTokens;

    // @ts-expect-error This is overriding the method
    this.getNumTokensFromGenerations = (_generations: ChatGeneration[]): Promise<number> => {
      return Promise.resolve(0);
    };

    this.getNumTokensFromMessages = (
      _messages: BaseMessage[]
    ): Promise<{ totalCount: number; countPerMessage: number[] }> => {
      return new Promise((resolve, _) => {
        resolve({ totalCount: 0, countPerMessage: [0] });
      });
    };
  }
}
