import { UpstashError } from "./error/model";

import { Config } from "./config";
import { Database } from "./database";
import { UpstashVectorError } from "./error/vector";
import { HistoryService } from "./history-service";
import type { CustomPrompt } from "./rag-chat-base";
import { RAGChatBase } from "./rag-chat-base";
import { RateLimitService } from "./ratelimit-service";
import type { ChatOptions, RAGChatConfig, UpstashDict } from "./types";
import { appendDefaultsIfNeeded, formatFacts } from "./utils";
import { RatelimitUpstashError } from "./error";
import { DEFAULT_NAMESPACE } from "./constants";

type ChatReturnType<T extends Partial<ChatOptions>> = Promise<
  T["streaming"] extends true
    ? {
        output: ReadableStream<string>;
        isStream: true;
      }
    : { output: string; isStream: false }
>;

export class RAGChat extends RAGChatBase {
  #ratelimitService: RateLimitService;

  private readonly promptFn: CustomPrompt;
  public readonly streaming?: boolean;
  public readonly namespace?: string;
  public readonly metadata?: UpstashDict | undefined;
  public readonly sessionId?: string | undefined;
  private readonly ratelimitSessionId?: string;

  constructor(config?: RAGChatConfig) {
    const {
      vector: index,
      redis,
      model,
      prompt,
      ratelimit,
      ratelimitSessionId,
      metadata,
      namespace,
      sessionId,
      streaming,
    } = new Config(config);

    if (!index) {
      throw new UpstashVectorError("Vector can not be undefined!");
    }

    const vectorService = new Database(index);
    const historyService = new HistoryService({
      redis,
    });

    if (!model) {
      throw new UpstashError("Model can not be undefined!");
    }

    super(
      vectorService,
      historyService,
      {
        model,
        prompt,
      },
      namespace ?? DEFAULT_NAMESPACE
    );

    this.promptFn = prompt;
    this.metadata = metadata;
    this.namespace = namespace;
    this.sessionId = sessionId;
    this.streaming = streaming;
    this.ratelimitSessionId = ratelimitSessionId;

    this.#ratelimitService = new RateLimitService(ratelimit);
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
  async chat<TChatOptions extends ChatOptions>(
    input: string,
    options?: TChatOptions
  ): Promise<ChatReturnType<TChatOptions>> {
    try {
      // Adds all the necessary default options that users can skip in the options parameter above.
      const optionsWithDefault = appendDefaultsIfNeeded({
        ...options,
        metadata: options?.metadata ?? this.metadata,
        namespace: options?.namespace ?? this.namespace,
        streaming: options?.streaming ?? this.streaming,
        sessionId: options?.sessionId ?? this.sessionId,
        ratelimitSessionId: options?.ratelimitSessionId ?? this.ratelimitSessionId,
      });

      // Checks ratelimit of the user. If not enabled `success` will be always true.
      const ratelimitResponse = await this.#ratelimitService.checkLimit(
        optionsWithDefault.ratelimitSessionId
      );

      options?.ratelimitDetails?.(ratelimitResponse);
      if (!ratelimitResponse.success) {
        throw new RatelimitUpstashError("Couldn't process chat due to ratelimit.", {
          error: "ERR:USER_RATELIMITED",
          resetTime: ratelimitResponse.reset,
        });
      }

      // 👇 when ragChat.chat is called, we first add the user message to chat history (without real id)
      await this.history.addMessage({
        message: { content: input, role: "user" },
        sessionId: optionsWithDefault.sessionId,
      });
      // Sanitizes the given input by stripping all the newline chars. Then, queries vector db with sanitized question.
      const { question, context: originalContext } = await this.prepareChat({
        question: input,
        similarityThreshold: optionsWithDefault.similarityThreshold,
        topK: optionsWithDefault.topK,
        namespace: optionsWithDefault.namespace,
      });

      // clone context to avoid mutation issues
      const clonedContext = structuredClone(originalContext);
      const modifiedContext = await options?.onContextFetched?.(clonedContext);

      const context = formatFacts((modifiedContext ?? originalContext).map(({ data }) => data));

      // Gets the chat history from redis or in-memory store.
      const chatHistory = await this.history.getMessages({
        sessionId: optionsWithDefault.sessionId,
        amount: optionsWithDefault.historyLength,
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
      return (
        optionsWithDefault.streaming ? this.makeStreamingLLMRequest : this.makeLLMRequest
      ).call(this, {
        prompt,
        onChunk: options?.onChunk,
        onComplete: async (output) => {
          await this.history.addMessage({
            message: { content: output, metadata: optionsWithDefault.metadata, role: "assistant" },
            sessionId: optionsWithDefault.sessionId,
          });
        },
      }) as ChatReturnType<TChatOptions>;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
