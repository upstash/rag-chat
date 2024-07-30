/* eslint-disable @typescript-eslint/no-explicit-any */
import { HumanMessage, type BaseMessage } from "@langchain/core/messages";

import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { IterableReadableStreamInterface } from "@langchain/core/utils/stream";
import { ContextService } from "./context-service";
import type { Database, VectorPayload } from "./database";
import type { HistoryService } from "./history-service";
import type { ChatOptions, PrepareChatResult, UpstashMessage } from "./types";
import type { InMemoryHistory } from "./history-service/in-memory-history";
import type { UpstashRedisHistory } from "./history-service/redis-custom-history";
import { ChatLogger } from "./logger";

export type PromptParameters = { chatHistory?: string; question: string; context: string };

export type CustomPrompt = ({ question, chatHistory, context }: PromptParameters) => string;

export type Message = { id: string; content: string; role: "ai" | "user" };

const TRUE = 1;
export class RAGChatBase {
  // Database service for vector operations.
  protected vectorService: Database;

  // Service for managing conversation context.
  context: ContextService;

  // History service to store conversation history.
  history: UpstashRedisHistory | InMemoryHistory;

  // Private field holding the language model instance.
  #model: BaseLanguageModelInterface;

  protected readonly debug?: ChatLogger;

  constructor(
    vectorService: Database,
    historyService: HistoryService,
    config: { model: BaseLanguageModelInterface; prompt: CustomPrompt },
    namespace: string,
    debug: boolean
  ) {
    this.vectorService = vectorService;

    this.history = historyService.service;
    this.context = new ContextService(vectorService, namespace);
    this.#model = config.model;
    this.debug = debug
      ? new ChatLogger({
          logLevel: "INFO",
          logOutput: "console",
        })
      : undefined;
  }

  /**
   * Prepares the chat environment by retrieving context for the given question.
   * @returns Promise that resolves to PrepareChatResult, containing the sanitized question and retrieved context.
   */
  protected async prepareChat({
    question,
    similarityThreshold,
    topK,
    namespace,
  }: VectorPayload): Promise<PrepareChatResult> {
    // Sanitize the input question to ensure consistency.
    await this.debug?.logSendPrompt(question);

    this.debug?.startRetrieveContext();
    // Retrieve context relevant to the sanitized question using vector operations.
    const context = await this.vectorService.retrieve({
      question,
      similarityThreshold,
      topK,
      namespace,
    });

    await this.debug?.endRetrieveContext(context);
    // Return the sanitized question and the retrieved context for further processing.
    return context;
  }

  protected async makeStreamingLLMRequest({
    prompt,
    onComplete,
    onChunk,
  }: {
    prompt: string;
    onComplete?: (output: string) => void;
    onChunk?: ChatOptions["onChunk"];
  }): Promise<{
    output: ReadableStream<string>;
    isStream: true;
  }> {
    const stream = (await this.#model.stream([
      new HumanMessage(prompt),
    ])) as IterableReadableStreamInterface<UpstashMessage>;

    const reader = stream.getReader();
    let concatenatedOutput = "";

    const newStream = new ReadableStream<string>({
      start(controller) {
        const processStream = async () => {
          let done: boolean | undefined;
          let value: UpstashMessage | undefined;

          try {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            while (TRUE) {
              ({ done, value } = await reader.read());
              if (done) {
                break;
              }

              const message = value?.content ?? "";
              onChunk?.({
                content: message,
                inputTokens: value?.usage_metadata?.input_tokens ?? 0,
                chunkTokens: value?.usage_metadata?.output_tokens ?? 0,
                totalTokens: value?.usage_metadata?.total_tokens ?? 0,
                // This actually streamed output from LLM, but cast it to UpstashMessage above to make everything type. But, in this case its not needed
                rawContent: value as unknown as string,
              });
              concatenatedOutput += message;

              controller.enqueue(message);
            }

            controller.close();

            // Call the onComplete callback with the concatenated output
            if (onComplete) {
              onComplete(concatenatedOutput);
            }
          } catch (error) {
            controller.error(error);
          }
        };

        void processStream();
      },
    });

    return { output: newStream, isStream: true };
  }

  protected async makeLLMRequest({
    prompt,
    onComplete,
  }: {
    prompt: string;
    onComplete?: (output: string) => void;
  }): Promise<{ output: string; isStream: false }> {
    const { content } = (await this.#model.invoke(prompt)) as BaseMessage;
    onComplete?.(content as string);
    return { output: content as string, isStream: false };
  }
}
