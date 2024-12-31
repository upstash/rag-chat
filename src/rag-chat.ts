import { UpstashError } from "./error/model";

import { traceable } from "langsmith/traceable";
import { Config } from "./config";
import {
  DEFAULT_CHAT_RATELIMIT_SESSION_ID,
  DEFAULT_CHAT_SESSION_ID,
  DEFAULT_HISTORY_LENGTH,
  DEFAULT_HISTORY_TTL,
  DEFAULT_NAMESPACE,
  DEFAULT_PROMPT_WITHOUT_RAG,
  DEFAULT_SIMILARITY_THRESHOLD,
  DEFAULT_TOP_K,
} from "./constants";
import { ContextService } from "./context-service";
import { Database } from "./database";
import { RatelimitUpstashError } from "./error";
import { UpstashVectorError } from "./error/vector";
import { HistoryService } from "./history-service";
import type { InMemoryHistory } from "./history-service/in-memory-history";
import type { UpstashRedisHistory } from "./history-service/redis-custom-history";
import { LLMService } from "./llm-service";
import { ChatLogger } from "./logger";
import { RateLimitService } from "./ratelimit-service";
import type { ChatOptions, PrepareChatResult, RAGChatConfig, UpstashMessage } from "./types";
import type { ModifiedChatOptions } from "./utils";
import { sanitizeQuestion } from "./utils";

export type PromptParameters = { chatHistory?: string; question: string; context: string };

export type CustomPrompt = ({ question, chatHistory, context }: PromptParameters) => string;

export type Message = { id: string; content: string; role: "ai" | "user" };

type ChatReturnType<TMetadata extends unknown[], T extends Partial<ChatOptions>> = Promise<
  (T["streaming"] extends true
    ? {
        output: ReadableStream<string>;
        isStream: true;
      }
    : { output: string; isStream: false }) & {
    metadata: TMetadata;
    context: PrepareChatResult;
    history: UpstashMessage[];
  }
>;

export class RAGChat {
  private ratelimit: RateLimitService;
  private llm: LLMService;
  context: ContextService;
  history: UpstashRedisHistory | InMemoryHistory;
  private config: Config;
  private debug?: ChatLogger;

  constructor(config?: RAGChatConfig) {
    this.config = new Config(config);

    if (!this.config.vector) {
      throw new UpstashVectorError("Vector can not be undefined!");
    }

    if (!this.config.model) {
      throw new UpstashError("Model can not be undefined!");
    }

    const vectorService = new Database(this.config.vector);
    this.history = new HistoryService({
      redis: this.config.redis,
    }).service;
    this.llm = new LLMService(this.config.model);
    this.context = new ContextService(vectorService, this.config.namespace ?? DEFAULT_NAMESPACE);
    this.debug = this.config.debug
      ? new ChatLogger({
          logLevel: "INFO",
          logOutput: "console",
        })
      : undefined;
    this.ratelimit = new RateLimitService(this.config.ratelimit);
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
  async chat<TMetadata extends object, TChatOptions extends ChatOptions = ChatOptions>(
    input: string,
    options?: TChatOptions
  ): Promise<ChatReturnType<TMetadata[], TChatOptions>> {
    return traceable(
      async (input: string, options?: TChatOptions) => {
        try {
          const optionsWithDefault = this.getOptionsWithDefaults(options);

          // Checks ratelimit of the user. If not enabled `success` will be always true.
          await this.checkRatelimit(optionsWithDefault);

          // Only add user message to history if disableHistory is false
          if (!optionsWithDefault.disableHistory) {
            await this.addUserMessageToHistory(input, optionsWithDefault);
          }

          // Sanitizes the given input by stripping all the newline chars.
          const question = sanitizeQuestion(input);
          const {
            formattedContext: context,
            metadata,
            rawContext,
          } = await this.context._getContext<TMetadata>(
            optionsWithDefault,
            options?.embedding ?? input,
            this.debug
          )(optionsWithDefault.sessionId);

          const { formattedHistory, modifiedChatHistory } =
            await this.getChatHistory(optionsWithDefault);

          const prompt = await this.generatePrompt(
            optionsWithDefault,
            context,
            question,
            formattedHistory
          );

          //   Either calls streaming or non-streaming function from RAGChatBase. Streaming function returns AsyncIterator and allows callbacks like onComplete.
          const llmResult = await this.llm.callLLM<TChatOptions>(
            optionsWithDefault,
            options,
            {
              onChunk: optionsWithDefault.onChunk,
              onComplete: async (output) => {
                await this.debug?.endLLMResponse(output);
                if (!optionsWithDefault.disableHistory) {
                  await this.addAssistantMessageToHistory(output, optionsWithDefault);
                }
              },
            },
            this.debug
          )(prompt);

          return {
            ...llmResult,
            metadata,
            context: rawContext ?? [],
            history: modifiedChatHistory,
          };
        } catch (error) {
          await this.debug?.logError(error as Error);
          throw error;
        }
      },
      {
        name: "Rag Chat",
        ...(global.globalTracer === undefined
          ? { tracingEnabled: false, client: undefined }
          : { client: global.globalTracer, tracingEnabled: true }),
        project_name: "Upstash Rag Chat",
        tags: [options?.streaming ? "streaming" : "non-streaming"],
        metadata: this.getOptionsWithDefaults(options),
      }
    )(input, options);
  }

  private generatePrompt(
    optionsWithDefault: ModifiedChatOptions,
    context: string,
    question: string,
    formattedHistory: string
  ) {
    return traceable(
      async (
        optionsWithDefault: ModifiedChatOptions,
        context: string,
        question: string,
        formattedHistory: string
      ) => {
        const prompt = optionsWithDefault.promptFn({
          context,
          question,
          chatHistory: formattedHistory,
        });
        await this.debug?.logFinalPrompt(prompt);
        return prompt;
      },
      { name: "Final Prompt", run_type: "prompt" }
    )(optionsWithDefault, context, question, formattedHistory);
  }

  private async getChatHistory(_optionsWithDefault: ModifiedChatOptions) {
    return traceable(
      async (optionsWithDefault: ModifiedChatOptions) => {
        if (optionsWithDefault.disableHistory) {
          await this.debug?.logRetrieveFormatHistory("History disabled, returning empty history");
          return { formattedHistory: "", modifiedChatHistory: [] };
        }
        this.debug?.startRetrieveHistory();
        // Gets the chat history from redis or in-memory store.
        const originalChatHistory = await this.history.getMessages({
          sessionId: optionsWithDefault.sessionId,
          amount: optionsWithDefault.historyLength,
        });
        const clonedChatHistory = structuredClone(originalChatHistory);
        const modifiedChatHistory =
          (await optionsWithDefault.onChatHistoryFetched?.(clonedChatHistory)) ??
          originalChatHistory;
        await this.debug?.endRetrieveHistory(modifiedChatHistory);

        // Formats the chat history for better accuracy when querying LLM
        const formattedHistory = modifiedChatHistory
          .map((message) => {
            return message.role === "user"
              ? `USER MESSAGE: ${message.content}`
              : `YOUR MESSAGE: ${message.content}`;
          })
          .join("\n");
        await this.debug?.logRetrieveFormatHistory(formattedHistory);
        return { formattedHistory, modifiedChatHistory };
      },
      {
        name: "Retrieve History",
        tags: [this.config.redis === undefined ? "in-memory" : "redis"],
        metadata: { sessionId: _optionsWithDefault.sessionId },
        run_type: "retriever",
      }
    )(_optionsWithDefault);
  }

  private async addUserMessageToHistory(input: string, optionsWithDefault: ModifiedChatOptions) {
    await this.history.addMessage({
      message: { content: input, role: "user" },
      sessionId: optionsWithDefault.sessionId,
    });
  }

  private async addAssistantMessageToHistory(
    output: string,
    optionsWithDefault: ModifiedChatOptions
  ) {
    await this.history.addMessage({
      message: {
        content: output,
        metadata: optionsWithDefault.metadata,
        role: "assistant",
      },
      sessionId: optionsWithDefault.sessionId,
    });
  }

  private async checkRatelimit(optionsWithDefault: ModifiedChatOptions) {
    const ratelimitResponse = await this.ratelimit.checkLimit(
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

    return {
      onChatHistoryFetched: options?.onChatHistoryFetched,
      onContextFetched: options?.onContextFetched,
      onChunk: options?.onChunk,
      ratelimitDetails: options?.ratelimitDetails,
      metadata: options?.metadata ?? this.config.metadata,
      namespace: options?.namespace ?? this.config.namespace ?? DEFAULT_NAMESPACE,
      streaming: options?.streaming ?? this.config.streaming ?? false,
      sessionId: options?.sessionId ?? this.config.sessionId ?? DEFAULT_CHAT_SESSION_ID,
      disableRAG: options?.disableRAG ?? false,
      disableHistory: options?.disableHistory ?? false,
      similarityThreshold: options?.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD,
      topK: options?.topK ?? DEFAULT_TOP_K,
      historyLength: options?.historyLength ?? DEFAULT_HISTORY_LENGTH,
      historyTTL: options?.historyTTL ?? DEFAULT_HISTORY_TTL,
      ratelimitSessionId:
        options?.ratelimitSessionId ??
        this.config.ratelimitSessionId ??
        DEFAULT_CHAT_RATELIMIT_SESSION_ID,
      promptFn: isRagDisabledAndPromptFunctionMissing
        ? DEFAULT_PROMPT_WITHOUT_RAG
        : (options?.promptFn ?? this.config.prompt),
      contextFilter: options?.contextFilter ?? undefined,
      queryMode: options?.queryMode ?? undefined,
    };
  }
}
