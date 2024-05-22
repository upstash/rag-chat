import type { AIMessage } from "@langchain/core/messages";
import type { StreamingTextResponse } from "ai";

import { QA_PROMPT_TEMPLATE } from "./prompts";

import { UpstashModelError } from "./error/model";
import { RatelimitUpstashError } from "./error/ratelimit";

import type { Config } from "./config";
import { RAGChatBase } from "./rag-chat-base";
import type { AddContextPayload } from "./services";
import { HistoryService, RetrievalService } from "./services";
import { RateLimitService } from "./services/ratelimit";
import type { ChatOptions } from "./types";
import { appendDefaultsIfNeeded } from "./utils";

export class RAGChat extends RAGChatBase {
  #ratelimitService: RateLimitService;

  constructor(config: Config) {
    const { vector: index, redis } = config;

    const historyService = new HistoryService(redis);
    const retrievalService = new RetrievalService(index);
    const ratelimitService = new RateLimitService(config.ratelimit);

    if (!config.model) {
      throw new UpstashModelError("Model can not be undefined!");
    }
    super(retrievalService, historyService, {
      model: config.model,
      prompt: config.prompt ?? QA_PROMPT_TEMPLATE,
    });
    this.#ratelimitService = ratelimitService;
  }

  async chat(input: string, options: ChatOptions): Promise<StreamingTextResponse | AIMessage> {
    // Adds chat session id and ratelimit session id if not provided.
    const options_ = appendDefaultsIfNeeded(options);

    // Checks ratelimit of the user. If not enabled `success` will be always true.
    const { success, resetTime } = await this.#ratelimitService.checkLimit(
      options_.ratelimitSessionId
    );

    if (!success) {
      throw new RatelimitUpstashError("Couldn't process chat due to ratelimit.", {
        error: "ERR:USER_RATELIMITED",
        resetTime: resetTime,
      });
    }

    // Sanitizes the given input by stripping all the newline chars. Then, queries vector db with sanitized question.
    const { question, facts } = await this.prepareChat({
      question: input,
      similarityThreshold: options_.similarityThreshold,
      metadataKey: options_.metadataKey,
      topK: options_.topK,
    });

    // Calls LLM service with organized prompt. Prompt holds chat_history, facts gathered from vector db and sanitized question.
    // Allows either streaming call via Vercel AI SDK or non-streaming call
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

  /** Method to get history of messages used in the RAG Chat*/
  getHistory() {
    return this.historyService;
  }
}
