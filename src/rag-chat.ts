import { UpstashModelError } from "./error/model";
import { RatelimitUpstashError } from "./error/ratelimit";

import { Config } from "./config";
import { Database } from "./database";
import { HistoryService } from "./history-service";
import type { CustomPrompt } from "./rag-chat-base";
import { RAGChatBase } from "./rag-chat-base";
import { RateLimitService } from "./ratelimit-service";
import type { ChatOptions, RAGChatConfig } from "./types";
import { appendDefaultsIfNeeded } from "./utils";
import { UpstashVectorError } from "./error/vector";

type ChatReturnType<T extends Partial<ChatOptions>> = Promise<
  T["streaming"] extends true
    ? {
        output: ReadableStream<string>;
        isStream: boolean;
      }
    : { output: string; isStream: false }
>;

export class RAGChat extends RAGChatBase {
  #ratelimitService: RateLimitService;
  protected promptFn: CustomPrompt;

  constructor(config?: RAGChatConfig) {
    const { vector: index, redis, model, prompt } = new Config(config);

    if (!index) {
      throw new UpstashVectorError("Vector can not be undefined!");
    }

    const vectorService = new Database(index);
    const historyService = new HistoryService({
      redis,
    });

    if (!model) {
      throw new UpstashModelError("Model can not be undefined!");
    }

    super(vectorService, historyService, {
      model,
      prompt,
    });

    this.promptFn = prompt;

    this.#ratelimitService = new RateLimitService(config?.ratelimit);
  }

  /**
   * A method that allows you to chat LLM using Vector DB as your knowledge store and Redis - optional - as a chat history.
   *
   * @example
   * ```typescript
   *await ragChat.chat("Where is the capital of Turkey?", {
   *  stream: false,
   *})
   * ```
   */
  async chat<const TChatOptions extends Partial<ChatOptions>>(
    input: string,
    options?: Partial<TChatOptions>
  ): Promise<ChatReturnType<TChatOptions>> {
    try {
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

      // 👇 when ragChat.chat is called, we first add the user message to chat history (without real id)
      await this.history.addMessage({
        message: { content: input, role: "user" },
        sessionId: options_.sessionId,
      });

      // Sanitizes the given input by stripping all the newline chars. Then, queries vector db with sanitized question.
      const { question, context } = await this.prepareChat({
        question: input,
        similarityThreshold: options_.similarityThreshold,
        topK: options_.topK,
        namespace: options_.namespace,
      });

      // Gets the chat history from redis or in-memory store.
      const chatHistory = await this.history.getMessages({
        sessionId: options_.sessionId,
        amount: options_.historyLength,
      });

      // Formats the chat history for better accuracy when querying LLM
      const formattedHistory = chatHistory
        .reverse()
        .map((message) => {
          return message.role === "user"
            ? `USER MESSAGE: ${message.content}`
            : `YOUR MESSAGE: ${message.content}`;
        })
        .join("\n");

      // Allows users to pass type-safe prompts
      const prompt = this.promptFn({ context, question, chatHistory: formattedHistory });

      // Either calls streaming or non-streaming function from RAGChatBase. Streaming function returns AsyncIterator and allows callbacks like onComplete.
      //@ts-expect-error TS can't infer types because of .call()
      return (options_.streaming ? this.makeStreamingLLMRequest : this.makeLLMRequest).call(this, {
        prompt,
        onComplete: async (output) => {
          await this.history.addMessage({
            message: { content: output, metadata: options_.metadata, role: "assistant" },
            sessionId: options_.sessionId,
          });
        },
      }) as ChatReturnType<TChatOptions>;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
