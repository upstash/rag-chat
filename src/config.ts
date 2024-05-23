import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { PromptTemplate } from "@langchain/core/prompts";
import type { RAGChatConfig } from "./types";
import type { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import type { Index } from "@upstash/vector";

export class Config {
  public readonly vector: Index;
  public readonly redis?: Redis;
  public readonly ratelimit?: Ratelimit;

  public readonly model?: BaseLanguageModelInterface;
  public readonly prompt?: PromptTemplate;

  constructor(config: RAGChatConfig) {
    this.vector = config.vector;
    this.redis = config.redis;

    this.ratelimit = config.ratelimit;

    this.model = config.model;
    this.prompt = config.prompt;
  }
}
