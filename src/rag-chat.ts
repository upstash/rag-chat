import type { AIMessage } from "@langchain/core/messages";
import type { StreamingTextResponse } from "ai";

import { QA_PROMPT_TEMPLATE } from "./prompts";

import { UpstashModelError } from "./error/model";
import { RatelimitUpstashError } from "./error/ratelimit";

import type { Config } from "./config";
import { RAGChatBase } from "./rag-chat-base";
import type { AddContextOptions, AddContextPayload } from "./services";
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

  /**
   * A method that allows you to chat LLM using Vector DB as your knowledge store and Redis - optional - as a chat history.
   *
   * @example
   * ```typescript
   *    await ragChat.chat("Where is the capital of Turkiye?", {
   *        stream: false,
   *      })
   * ```
   */
  async chat(input: string, options: ChatOptions): Promise<StreamingTextResponse | AIMessage> {
    // Adds all the necessary default options that users can skip in the options parameter above.
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

  /**
   * A method that allows you to add various data types into a vector database.
   * It supports plain text, embeddings, PDF, and CSV. Additionally, it handles text-splitting for CSV and PDF.
   *
   * @example
   * ```typescript
   * await addDataToVectorDb({
   *   dataType: "pdf",
   *   fileSource: "./data/the_wonderful_wizard_of_oz.pdf",
   *   opts: { chunkSize: 500, chunkOverlap: 50 },
   * });
   * // OR
   * await addDataToVectorDb({
   *   dataType: "text",
   *   data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
   * });
   * ```
   */
  async addContext(context: AddContextPayload, options?: AddContextOptions) {
    const retrievalServiceStatus = await this.retrievalService.addDataToVectorDb(context, options);
    return retrievalServiceStatus === "Success" ? "OK" : "NOT-OK";
  }

  /** Method to get history of messages used in the RAG Chat*/
  getHistory() {
    return this.historyService;
  }
}
