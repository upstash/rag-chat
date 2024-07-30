import { UpstashError } from "./error/model";

import { Config } from "./config";
import { Database } from "./database";
import { UpstashVectorError } from "./error/vector";
import { HistoryService } from "./history-service";
import type { CustomPrompt } from "./rag-chat-base";
import { RAGChatBase } from "./rag-chat-base";
import { RateLimitService } from "./ratelimit-service";
import type { ChatOptions, RAGChatConfig, UpstashDict } from "./types";
import type { ModifiedChatOptions } from "./utils";
import { appendDefaultsIfNeeded, formatFacts, sanitizeQuestion } from "./utils";
import { RatelimitUpstashError } from "./error";
import { DEFAULT_NAMESPACE, DEFAULT_PROMPT_WITHOUT_RAG } from "./constants";

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
  private readonly streaming?: boolean;
  private readonly namespace?: string;
  private readonly metadata?: UpstashDict | undefined;
  private readonly sessionId?: string | undefined;
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
      debug,
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
      namespace ?? DEFAULT_NAMESPACE,
      Boolean(debug)
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
      const optionsWithDefault = this.getOptionsWithDefaults(options);
      // Checks ratelimit of the user. If not enabled `success` will be always true.
      await this.checkRatelimit(optionsWithDefault);

      // 👇 when ragChat.chat is called, we first add the user message to chat history (without real id)
      await this.addUserMessageToHistory(input, optionsWithDefault);

      // Sanitizes the given input by stripping all the newline chars.
      const question = sanitizeQuestion(input);
      const context = await this.getContext(optionsWithDefault, input);
      const formattedHistory = await this.getChatHistory(optionsWithDefault);

      const prompt = await this.generatePrompt(
        optionsWithDefault,
        context,
        question,
        formattedHistory
      );

      // Either calls streaming or non-streaming function from RAGChatBase. Streaming function returns AsyncIterator and allows callbacks like onComplete.
      return this.callLLM<TChatOptions>(optionsWithDefault, prompt, options);
    } catch (error) {
      await this.debug?.logError(error as Error);
      throw error;
    }
  }

  private callLLM<TChatOptions extends ChatOptions>(
    optionsWithDefault: ModifiedChatOptions,
    prompt: string,
    _options: TChatOptions | undefined
  ) {
    this.debug?.startLLMResponse();
    //@ts-expect-error TS can't infer types because of .call()
    const result = (
      optionsWithDefault.streaming ? this.makeStreamingLLMRequest : this.makeLLMRequest
    ).call(this, {
      prompt,
      onChunk: optionsWithDefault.onChunk,
      onComplete: async (output) => {
        await this.debug?.endLLMResponse(output);
        await this.history.addMessage({
          message: { content: output, metadata: optionsWithDefault.metadata, role: "assistant" },
          sessionId: optionsWithDefault.sessionId,
        });
      },
    }) as ChatReturnType<TChatOptions>;
    return result;
  }

  private async generatePrompt(
    optionsWithDefault: ModifiedChatOptions,
    context: string,
    question: string,
    formattedHistory: string
  ) {
    const prompt = optionsWithDefault.promptFn({
      context,
      question,
      chatHistory: formattedHistory,
    });
    await this.debug?.logFinalPrompt(prompt);
    return prompt;
  }

  private async getChatHistory(optionsWithDefault: ModifiedChatOptions) {
    this.debug?.startRetrieveHistory();
    // Gets the chat history from redis or in-memory store.
    const originalChatHistory = await this.history.getMessages({
      sessionId: optionsWithDefault.sessionId,
      amount: optionsWithDefault.historyLength,
    });
    const clonedChatHistory = structuredClone(originalChatHistory);
    const modifiedChatHistory =
      (await optionsWithDefault.onChatHistoryFetched?.(clonedChatHistory)) ?? originalChatHistory;
    await this.debug?.endRetrieveHistory(clonedChatHistory);

    // Formats the chat history for better accuracy when querying LLM
    const formattedHistory = modifiedChatHistory
      .reverse()
      .map((message) => {
        return message.role === "user"
          ? `USER MESSAGE: ${message.content}`
          : `YOUR MESSAGE: ${message.content}`;
      })
      .join("\n");
    await this.debug?.logRetrieveFormatHistory(formattedHistory);
    return formattedHistory;
  }

  private async getContext(optionsWithDefault: ModifiedChatOptions, input: string) {
    if (optionsWithDefault.disableRAG) return "";
    // Queries vector db with sanitized question.
    const originalContext = await this.prepareChat({
      question: input,
      similarityThreshold: optionsWithDefault.similarityThreshold,
      topK: optionsWithDefault.topK,
      namespace: optionsWithDefault.namespace,
    });
    // clone context to avoid mutation issues
    const clonedContext = structuredClone(originalContext);
    const modifiedContext = await optionsWithDefault.onContextFetched?.(clonedContext);
    return formatFacts((modifiedContext ?? originalContext).map(({ data }) => data));
  }

  private async addUserMessageToHistory(input: string, optionsWithDefault: ModifiedChatOptions) {
    await this.history.addMessage({
      message: { content: input, role: "user" },
      sessionId: optionsWithDefault.sessionId,
    });
  }

  private async checkRatelimit(optionsWithDefault: ModifiedChatOptions) {
    const ratelimitResponse = await this.#ratelimitService.checkLimit(
      optionsWithDefault.ratelimitSessionId
    );

    optionsWithDefault.ratelimitDetails?.(ratelimitResponse);
    if (!ratelimitResponse.success) {
      throw new RatelimitUpstashError("Couldn't process chat due to ratelimit.", {
        error: "ERR:USER_RATELIMITED",
        resetTime: ratelimitResponse.reset,
      });
    }
  }

  private getOptionsWithDefaults(options?: ChatOptions): ModifiedChatOptions {
    const isRagDisabledAndPromptFunctionMissing = options?.disableRAG && !options.promptFn;
    // Adds all the necessary default options that users can skip in the options parameter above.
    return appendDefaultsIfNeeded({
      ...options,
      metadata: options?.metadata ?? this.metadata,
      namespace: options?.namespace ?? this.namespace,
      streaming: options?.streaming ?? this.streaming,
      sessionId: options?.sessionId ?? this.sessionId,
      ratelimitSessionId: options?.ratelimitSessionId ?? this.ratelimitSessionId,
      promptFn: isRagDisabledAndPromptFunctionMissing
        ? DEFAULT_PROMPT_WITHOUT_RAG
        : (options?.promptFn ?? this.promptFn),
    });
  }
}
