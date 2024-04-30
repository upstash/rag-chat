import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { PromptTemplate } from "@langchain/core/prompts";
import type { Index, Ratelimit, Redis, UpstashConfig } from "@upstash/sdk";
import type { Callbacks } from "@langchain/core/callbacks/manager";
import type { BaseMessage } from "@langchain/core/messages";
import { RunnableSequence, RunnableWithMessageHistory } from "@langchain/core/runnables";
import { Upstash } from "@upstash/sdk";
import { LangChainStream, StreamingTextResponse } from "ai";

import { RatelimiterClientConstructor } from "./clients/ratelimiter";
import { RedisClientConstructor } from "./clients/redis";
import { VectorClientConstructor } from "./clients/vector";
import { InternalUpstashError } from "./error/internal";
import { UpstashModelError } from "./error/model";
import { QA_TEMPLATE } from "./prompts";
import { redisChatMessagesHistory } from "./redis-custom-history";
import type { PreferredRegions } from "./types";
import { formatChatHistory, formatFacts, sanitizeQuestion } from "./utils";

const SIMILARITY_THRESHOLD = 0.5;

type CustomInputValues = { chat_history?: BaseMessage[]; question: string; context: string };

type RAGChatConfigCommon = {
  model: BaseLanguageModelInterface;
  template?: PromptTemplate;
  umbrellaConfig: Omit<UpstashConfig, "email" | "token">;
  preferredRegion?: PreferredRegions;
};

export type RAGChatConfig = (
  | {
      vector?: Index;
      redis?: string;
      ratelimit?: Ratelimit;
    }
  | {
      vector?: string;
      redis?: Redis;
      ratelimit?: Ratelimit;
    }
) &
  RAGChatConfigCommon;

export class RAGChat {
  private sdkClient: Upstash;
  private config?: RAGChatConfig;

  //CLIENTS
  private vectorClient?: Index;
  private redisClient?: Redis;
  private ratelimiterClient?: Ratelimit;

  constructor(email: string, token: string, config?: RAGChatConfig) {
    this.sdkClient = new Upstash({ email, token, ...config?.umbrellaConfig });
    this.config = config;
  }

  private async getFactsFromVector(
    question: string,
    similarityThreshold = SIMILARITY_THRESHOLD
  ): Promise<string> {
    if (!this.vectorClient)
      throw new InternalUpstashError("vectorClient is missing in getFactsFromVector");

    const index = this.vectorClient;
    const result = await index.query<{ value: string }>({
      data: question,
      topK: 5,
      includeMetadata: true,
      includeVectors: false,
    });

    const allValuesUndefined = result.every((embedding) => embedding.metadata?.value === undefined);
    if (allValuesUndefined) {
      throw new TypeError(`
        Query to the vector store returned ${result.length} vectors but none had "value" field in their metadata.
        Text of your vectors should be in the "value" field in the metadata for the RAG Chat.
      `);
    }

    const facts = result
      .filter((x) => x.score >= similarityThreshold)
      .map((embedding, index) => `- Context Item ${index}: ${embedding.metadata?.value ?? ""}`);
    return formatFacts(facts);
  }

  chat = async (
    input: string,
    chatOptions: { stream: boolean; sessionId: string; includeHistory?: number }
  ) => {
    await this.initializeClients();

    const question = sanitizeQuestion(input);
    const facts = await this.getFactsFromVector(question);

    const { stream, sessionId, includeHistory } = chatOptions;

    if (stream) {
      return this.chainCallStreaming(question, facts, sessionId, includeHistory);
    }

    return this.chainCall({ sessionId, includeHistory }, question, facts);
  };

  private chainCallStreaming = (
    question: string,
    facts: string,
    sessionId: string,
    includeHistory?: number
  ) => {
    const { stream, handlers } = LangChainStream();
    void this.chainCall({ sessionId, includeHistory }, question, facts, [handlers]);
    return new StreamingTextResponse(stream, {});
  };

  private chainCall(
    chatOptions: { sessionId: string; includeHistory?: number },
    question: string,
    facts: string,
    handlers?: Callbacks
  ) {
    if (!this.config?.model) throw new UpstashModelError("Model is missing!");

    const formattedHistoryChain = RunnableSequence.from<CustomInputValues>([
      {
        chat_history: (input) => formatChatHistory(input.chat_history ?? []),
        question: (input) => input.question,
        context: (input) => input.context,
      },
      this.config.template ?? QA_TEMPLATE,
      this.config.model,
    ]);

    if (!this.redisClient) throw new InternalUpstashError("redisClient is missing in chat");
    const redis = this.redisClient;

    const chainWithMessageHistory = new RunnableWithMessageHistory({
      runnable: formattedHistoryChain,
      getMessageHistory: (sessionId: string) =>
        redisChatMessagesHistory({
          sessionId,
          redis,
          length: chatOptions.includeHistory,
        }),
      inputMessagesKey: "question",
      historyMessagesKey: "chat_history",
    });

    return chainWithMessageHistory.invoke(
      {
        question,
        context: facts,
      },
      {
        callbacks: handlers ?? undefined,
        configurable: { sessionId: chatOptions.sessionId },
      }
    );
  }

  private async initializeClients() {
    if (!this.vectorClient)
      this.vectorClient = await new VectorClientConstructor({
        sdkClient: this.sdkClient,
        indexNameOrInstance: this.config?.vector,
        preferredRegion: this.config?.preferredRegion,
      }).getVectorClient();

    if (!this.redisClient)
      this.redisClient = await new RedisClientConstructor({
        sdkClient: this.sdkClient,
        redisDbNameOrInstance: this.config?.redis,
        preferredRegion: this.config?.preferredRegion,
      }).getRedisClient();

    if (!this.ratelimiterClient)
      this.ratelimiterClient = await new RatelimiterClientConstructor(
        this.sdkClient,
        this.redisClient
      ).getRatelimiterClient();
  }
}
