import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { PromptTemplate } from "@langchain/core/prompts";
import type { Index, Ratelimit, Redis } from "@upstash/sdk";

export type PreferredRegions = "eu-west-1" | "us-east-1";

export type ChatOptions = {
  stream: boolean;
  sessionId?: string;
  includeHistory?: number;
  similarityThreshold?: number;
  ratelimitSessionId?: string;
};

export type PrepareChatResult = {
  question: string;
  facts: string;
};

type RAGChatConfigCommon = {
  model?: BaseLanguageModelInterface;
  template?: PromptTemplate;
  region?: PreferredRegions;
  ratelimit?: Ratelimit;
};

export type RAGChatConfig = {
  vector?: string | Index;
  redis?: string | Redis;
} & RAGChatConfigCommon;
