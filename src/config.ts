import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { PromptTemplate } from "@langchain/core/prompts";
import type { RAGChatConfig } from "./types";
import type { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { Index } from "@upstash/vector";
import { UpstashLLMClient } from "./upstash-llm-client";
import { ChatOpenAI } from "@langchain/openai";
import { QA_PROMPT_TEMPLATE } from "./prompts";

export class Config {
  public readonly vector: Index;
  public readonly redis?: Redis;
  public readonly ratelimit?: Ratelimit;

  public readonly model?: BaseLanguageModelInterface;
  public readonly prompt: PromptTemplate;

  constructor(config: RAGChatConfig) {
    this.vector = config.vector ?? Index.fromEnv();
    this.redis = config.redis ?? initializeRedis();

    this.ratelimit = config.ratelimit;

    this.model = config.model ?? initializeModel();
    this.prompt = config.prompt ?? QA_PROMPT_TEMPLATE;
  }
}

/**
 * Attempts to create a Redis instance using environment variables.
 * If the required environment variables are not found, it catches the error
 * and returns undefined, allowing RAG CHAT to fall back to using an in-memory database.
 */
const initializeRedis = () => {
  try {
    return Redis.fromEnv();
  } catch {
    return;
  }
};

/**
 * Attempts to create a model instance using environment variables.
 * It first looks for QStash LLM tokens, if not present, looks for OpenAI tokens. If both of them are missing returns undefined.
 */
const initializeModel = () => {
  const qstashToken = process.env.UPSTASH_LLM_REST_TOKEN;
  const openAIToken = process.env.OPENAI_API_KEY;

  if (qstashToken)
    return new UpstashLLMClient({
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      apiKey: qstashToken,
      streaming: true,
    });

  if (openAIToken) {
    return new ChatOpenAI({
      modelName: "gpt-4o",
      streaming: true,
      verbose: false,
      apiKey: openAIToken,
    });
  }
};
