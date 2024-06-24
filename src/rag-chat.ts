import { UpstashModelError } from "./error/model";
import { RatelimitUpstashError } from "./error/ratelimit";

import type { StreamableValue } from "ai/rsc";
import { Config } from "./config";
import { MODEL_NAME_WITH_PROVIDER_SPLITTER } from "./constants.ts";
import { Database } from "./database";
import type { CustomPrompt } from "./rag-chat-base";
import { RAGChatBase } from "./rag-chat-base";
import { RateLimitService } from "./ratelimit";
import type { ChatOptions, RAGChatConfig } from "./types";
import { appendDefaultsIfNeeded } from "./utils";

export class RAGChat extends RAGChatBase {
  #ratelimitService: RateLimitService;
  protected promptFn: CustomPrompt;

  constructor(config: RAGChatConfig) {
    const { vector: index, redis, model, prompt } = new Config(config);
    const vectorService = new Database(index);

    if (!model) {
      throw new UpstashModelError("Model can not be undefined!");
    }
    const historyService = {
      redis,
      metadata: {
        modelNameWithProvider: `${model.getName()}${MODEL_NAME_WITH_PROVIDER_SPLITTER}${model.getName()}`,
      },
    };

    super(vectorService, historyService, {
      model,
      prompt,
    });

    this.promptFn = prompt;

    this.#ratelimitService = new RateLimitService(config.ratelimit);
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
  async chat<const T extends ChatOptions>(
    input: string,
    options: T
  ): Promise<
    T["streaming"] extends true
      ? { output: StreamableValue<string>; isStream: true }
      : { output: string; isStream: false }
  > {
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
        message: { content: input, metadata: options.metadata ?? {}, role: "user" },
        sessionId: options.sessionId,
      });

      // Sanitizes the given input by stripping all the newline chars. Then, queries vector db with sanitized question.
      const { question, context } = await this.prepareChat({
        question: input,
        similarityThreshold: options_.similarityThreshold,
        metadataKey: options_.metadataKey,
        topK: options_.topK,
        namespace: options.namespace ?? options.sessionId,
      });

      // Calls LLM service with organized prompt. Prompt holds chat_history, facts gathered from vector db and sanitized question.
      // Allows either streaming call via Vercel AI SDK or non-streaming call
      const chatHistory = await this.history.getMessages({
        sessionId: options.sessionId,
        amount: options.historyLength,
      });

      const formattedHistory = chatHistory
        .reverse()
        .map((message) => {
          return message.role === "user"
            ? `USER MESSAGE: ${message.content}`
            : `YOUR MESSAGE: ${message.content}`;
        })
        .join("\n");

      const prompt = this.promptFn({ context, question, chatHistory: formattedHistory });

      const aiResponse = await this.makeAiRequest({
        streaming: options.streaming,
        prompt,
        onComplete: async (output) => {
          await this.history.addMessage({
            message: { content: output, metadata: {}, role: "assistant" },
            sessionId: options.sessionId,
          });
        },
      });

      return aiResponse as T["streaming"] extends true
        ? { output: StreamableValue<string>; isStream: true }
        : { output: string; isStream: false };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
