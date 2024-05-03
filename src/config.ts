import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { PromptTemplate } from "@langchain/core/prompts";
import { Redis } from "@upstash/sdk";
import { Index } from "@upstash/sdk";
import type { PreferredRegions } from "./types";
import { UpstashModelError } from "./error/model";

type RAGChatConfigCommon = {
  model?: BaseLanguageModelInterface;
  template?: PromptTemplate;
  region?: PreferredRegions;
};

const PREFERRED_REGION: PreferredRegions = "us-east-1";
export const DEFAULT_VECTOR_DB_NAME = "upstash-rag-chat-vector";
export const DEFAULT_REDIS_DB_NAME = "upstash-rag-chat-redis";

export type RAGChatConfig = {
  vector?: string | Index;
  redis?: string | Redis;
} & RAGChatConfigCommon;

export class Config {
  public readonly token: string;
  public readonly email: string;

  public readonly region: PreferredRegions;
  public readonly vector?: string | Index;
  public readonly redis?: string | Redis;

  public readonly model: BaseLanguageModelInterface;
  public readonly template?: PromptTemplate;

  constructor(email: string, token: string, config?: RAGChatConfig) {
    this.email = email;
    this.token = token;
    this.region = config?.region ?? PREFERRED_REGION;

    this.vector =
      typeof config?.vector === "string" || config?.vector instanceof Index
        ? config.vector
        : DEFAULT_VECTOR_DB_NAME;

    this.redis =
      typeof config?.redis === "string" || config?.redis instanceof Redis
        ? config.redis
        : DEFAULT_REDIS_DB_NAME;

    if (!config?.model) {
      throw new UpstashModelError("Model can not be undefined!");
    }

    this.model = config.model;
    this.template = config.template;
  }
}
