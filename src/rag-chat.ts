import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { AIMessage } from "@langchain/core/messages";
import type { PromptTemplate } from "@langchain/core/prompts";
import type { StreamingTextResponse } from "ai";

import { HistoryService } from "./services/history";
import { RateLimitService } from "./services/ratelimit";
import type { AddContextPayload } from "./services/retrieval";
import { RetrievalService } from "./services/retrieval";

import { QA_TEMPLATE } from "./prompts";

import { UpstashModelError } from "./error/model";
import { RatelimitUpstashError } from "./error/ratelimit";

import { ClientFactory } from "./client-factory";
import { Config } from "./config";
import { RAGChatBase } from "./rag-chat-base";
import type { ChatOptions, RAGChatConfig } from "./types";
import { appendDefaultsIfNeeded } from "./utils";

export class RAGChat extends RAGChatBase {
  #ratelimitService: RateLimitService;

  constructor(
    retrievalService: RetrievalService,
    historyService: HistoryService,
    ratelimitService: RateLimitService,
    config: { model: BaseLanguageModelInterface; template: PromptTemplate }
  ) {
    super(retrievalService, historyService, config);
    this.#ratelimitService = ratelimitService;
  }

  async chat(input: string, options: ChatOptions): Promise<StreamingTextResponse | AIMessage> {
    // Adds chat session id and ratelimit session id if not provided.
    const options_ = appendDefaultsIfNeeded(options);

    //Checks ratelimit of the user. If not enabled `success` will be always true.
    const { success, resetTime } = await this.#ratelimitService.checkLimit(
      options_.ratelimitSessionId
    );

    if (!success) {
      throw new RatelimitUpstashError("Couldn't process chat due to ratelimit.", {
        error: "ERR:USER_RATELIMITED",
        resetTime: resetTime,
      });
    }

    //Sanitizes the given input by stripping all the newline chars then queries vector db with sanitized question.
    const { question, facts } = await this.prepareChat({
      question: input,
      similarityThreshold: options_.similarityThreshold,
      metadataKey: options_.metadataKey,
      topK: options_.topK,
    });

    return options.stream
      ? this.streamingChainCall(options_, question, facts)
      : this.chainCall(options_, question, facts);
  }

  /** Context can be either plain text or embeddings  */
  async addContext(context: AddContextPayload[] | string, metadataKey = "text") {
    const retrievalServiceStatus = await this.retrievalService.addEmbeddingOrTextToVectorDb(
      context,
      metadataKey
    );
    return retrievalServiceStatus === "Success" ? "OK" : "NOT-OK";
  }

  /**
   *  Prepares RAG Chat by creating or getting Redis, Vector and Ratelimit instances.
   */
  static async initialize(
    config: RAGChatConfig & { email: string; token: string }
  ): Promise<RAGChat> {
    const clientFactory = new ClientFactory(
      new Config(config.email, config.token, {
        redis: config.redis,
        region: config.region,
        vector: config.vector,
      })
    );
    const { vector: index, redis } = await clientFactory.init({ redis: true, vector: true });

    const historyService = new HistoryService(redis);
    const retrievalService = new RetrievalService(index);
    const ratelimitService = new RateLimitService(config.ratelimit);

    if (!config.model) {
      throw new UpstashModelError("Model can not be undefined!");
    }

    return new RAGChat(retrievalService, historyService, ratelimitService, {
      model: config.model,
      template: config.template ?? QA_TEMPLATE,
    });
  }
}
