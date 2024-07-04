import { ChatOpenAI } from "@langchain/openai";
import { type BaseMessage } from "@langchain/core/messages";
import { type ChatGeneration } from "@langchain/core/outputs";

export type LLMClientConfig = {
  model: string;
  apiKey: string;
  maxTokens?: number;
  stop?: string[];
  topP?: number;
  temperature?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  n?: number;
  logitBias?: Record<string, number>;
  logProbs?: number;
  topLogprobs?: number;
  baseUrl: string;
};

export class LLMClient extends ChatOpenAI {
  modelName: string;
  apiKey: string;
  maxTokens?: number;
  stop?: string[];
  temperature = 1;
  n = 1;
  topP = 1;
  frequencyPenalty = 0;
  presencePenalty = 0;
  logitBias?: Record<string, number>;
  logProbs?: number;
  topLogprobs?: number;

  constructor(config: LLMClientConfig) {
    super(
      {
        modelName: config.model,
        apiKey: config.apiKey,
        maxTokens: config.maxTokens,
        topP: config.topP,
        temperature: config.temperature,
        n: config.n,
        frequencyPenalty: config.frequencyPenalty,
        presencePenalty: config.presencePenalty,
        logitBias: config.logitBias,
        topLogprobs: config.topLogprobs,
        stop: config.stop,
      },
      {
        baseURL: config.baseUrl,
      }
    );

    this.modelName = config.model;
    this.apiKey = config.apiKey;
    this.maxTokens = config.maxTokens;
    this.logitBias = config.logitBias;
    this.topLogprobs = config.topLogprobs;
    this.stop = config.stop;

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
