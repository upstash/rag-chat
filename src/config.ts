import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { Index } from "@upstash/vector";
import { DEFAULT_PROMPT } from "./constants";
import { upstash, openai } from "./models";
import type { CustomPrompt } from "./rag-chat-base";
import type { RAGChatConfig } from "./types";

export class Config {
  public readonly vector?: Index;
  public readonly redis?: Redis;
  public readonly ratelimit?: Ratelimit;

  public readonly model?: BaseLanguageModelInterface;
  public readonly prompt: CustomPrompt;

  constructor(config?: RAGChatConfig) {
    this.vector = config?.vector ?? Index.fromEnv();
    this.redis = config?.redis ?? initializeRedis();

    this.ratelimit = config?.ratelimit;

    this.model = config?.model ?? initializeModel();
    this.prompt = config?.prompt ?? DEFAULT_PROMPT;
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
  const qstashToken = process.env.QSTASH_TOKEN;
  const openAIToken = process.env.OPENAI_API_KEY;

  if (qstashToken) return upstash("meta-llama/Meta-Llama-3-8B-Instruct", { apiKey: qstashToken });

  if (openAIToken) {
    return openai("gpt-4o", { apiKey: openAIToken });
  }

  throw new Error(
    "[RagChat Error]: Unable to connect to model. Pass one of OPENAI_API_KEY or QSTASH_TOKEN environment variables."
  );
};
