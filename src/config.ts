import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { PromptTemplate } from "@langchain/core/prompts";
import type { Ratelimit } from "@upstash/sdk";
import { Redis } from "@upstash/sdk";
import { Index } from "@upstash/sdk";
import type { PreferredRegions, RAGChatConfig } from "./types";
import { DEFAULT_REDIS_DB_NAME, DEFAULT_VECTOR_DB_NAME, PREFERRED_REGION } from "./constants";

export class Config {
  public readonly token: string;
  public readonly email: string;

  public readonly vector?: string | Index;
  public readonly redis?: string | Redis;
  public readonly ratelimit?: Ratelimit;

  public readonly region: PreferredRegions;
  public readonly model?: BaseLanguageModelInterface;
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

    this.ratelimit = config?.ratelimit;

    this.model = config?.model;
    this.template = config?.template;
  }
}
