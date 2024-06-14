import type { AIMessage } from "@langchain/core/messages";
import type { StreamingTextResponse } from "ai";

import { UpstashModelError } from "./error/model";
import { RatelimitUpstashError } from "./error/ratelimit";

import { Config } from "./config";
import { DEFAULT_CHAT_SESSION_ID } from "./constants.ts";
import type { AddContextPayload } from "./database";
import { Database } from "./database";
import { UpstashVectorError } from "./error/vector.ts";
import { History } from "./history";
import { RAGChatBase } from "./rag-chat-base";
import { RateLimitService } from "./ratelimit";
import type {
  AddContextOptions,
  ChatOptions,
  HistoryOptions,
  RAGChatConfig,
  UpstashDict,
  UpstashMessage,
} from "./types";
import { appendDefaultsIfNeeded } from "./utils";

export class RAGChat extends RAGChatBase {
  #ratelimitService: RateLimitService;

  constructor(config?: RAGChatConfig) {
    const { vector: index, redis, model, prompt } = new Config(config);

    const historyService = new History({
      redis,
    });

    if (!index) {
      throw new UpstashVectorError("Vector can not be undefined!");
    }
    const vectorService = new Database(index);

    if (!model) {
      throw new UpstashModelError("Model can not be undefined!");
    }
    super(vectorService, historyService, {
      model,
      prompt,
    });
    this.#ratelimitService = new RateLimitService(config?.ratelimit);
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
      namespace: options.namespace,
    });

    // Calls LLM service with organized prompt. Prompt holds chat_history, facts gathered from vector db and sanitized question.
    // Allows either streaming call via Vercel AI SDK or non-streaming call
    const chainCall = this.chainCall(options_, question, facts);
    return chainCall(options.stream);
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
    const retrievalServiceStatus = await this.vectorService.save(context, options);
    return retrievalServiceStatus === "Success" ? "OK" : "NOT-OK";
  }

  /** Method to get history of messages used in the RAG Chat*/
  getMessageHistory<TMetadata extends UpstashDict = UpstashDict>(
    options?: HistoryOptions
  ): Promise<UpstashMessage<TMetadata>[]> {
    return this.historyService
      .getMessageHistory({
        sessionId: options?.sessionId ?? DEFAULT_CHAT_SESSION_ID,
      })
      .getMessagesForUpstash<TMetadata>({ length: options?.length, offset: options?.offset });
  }

  /** Method to clear history of messages used in the RAG Chat*/
  clearHistory(options: HistoryOptions) {
    return this.historyService
      .getMessageHistory({
        sessionId: options.sessionId ?? DEFAULT_CHAT_SESSION_ID,
      })
      .clear();
  }
}
