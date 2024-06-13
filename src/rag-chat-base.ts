/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { RunnableSequence, RunnableWithMessageHistory } from "@langchain/core/runnables";
import { LangChainAdapter, StreamingTextResponse } from "ai";

import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { PromptTemplate } from "@langchain/core/prompts";
import type { ChatOptions, PrepareChatResult } from "./types";
import { formatChatHistory, sanitizeQuestion } from "./utils";
import type { Database, VectorPayload } from "./database";
import type { History } from "./history";

type CustomInputValues = { chat_history?: BaseMessage[]; question: string; context: string };

export class RAGChatBase {
  protected vectorService: Database;
  protected historyService: History;

  #model: BaseLanguageModelInterface;
  #prompt: PromptTemplate;

  constructor(
    vectorService: Database,
    historyService: History,
    config: { model: BaseLanguageModelInterface; prompt: PromptTemplate }
  ) {
    this.vectorService = vectorService;
    this.historyService = historyService;

    this.#model = config.model;
    this.#prompt = config.prompt;
  }

  protected async prepareChat({
    question: input,
    similarityThreshold,
    topK,
    metadataKey,
    namespace,
  }: VectorPayload): Promise<PrepareChatResult> {
    const question = sanitizeQuestion(input);
    const facts = await this.vectorService.retrieve({
      question,
      similarityThreshold,
      metadataKey,
      topK,
      namespace,
    });
    return { question, facts };
  }

  /** This method first gets required params, then returns another function depending on streaming param input */
  protected chainCall(chatOptions: ChatOptions, question: string, facts: string) {
    const formattedHistoryChain = RunnableSequence.from<CustomInputValues>([
      {
        chat_history: (input) => formatChatHistory(input.chat_history ?? []),
        question: (input) => input.question,
        context: (input) => input.context,
      },
      this.#prompt,
      this.#model,
    ]);

    const chainWithMessageHistory = new RunnableWithMessageHistory({
      runnable: formattedHistoryChain,
      getMessageHistory: (sessionId: string) =>
        this.historyService.getMessageHistory({
          sessionId,
          sessionTTL: chatOptions.historyTTL,
          length: chatOptions.historyLength,
          metadata: chatOptions.metadata,
        }),
      inputMessagesKey: "question",
      historyMessagesKey: "chat_history",
    });
    const runnableArgs = {
      input: {
        question,
        context: facts,
      },
      options: {
        configurable: { sessionId: chatOptions.sessionId },
      },
    };

    return (streaming: boolean) =>
      streaming
        ? this.streamingChainCall(chainWithMessageHistory, runnableArgs)
        : (chainWithMessageHistory.invoke(
            runnableArgs.input,
            runnableArgs.options
          ) as Promise<AIMessage>);
  }

  protected async streamingChainCall(
    runnable: RunnableWithMessageHistory<CustomInputValues, any>,
    runnableArgs: { input: CustomInputValues; options?: Partial<RunnableConfig> | undefined }
  ) {
    const stream = await runnable.stream(runnableArgs.input, runnableArgs.options);
    const wrappedStream = LangChainAdapter.toAIStream(stream);
    return new StreamingTextResponse(wrappedStream, {});
  }
}
