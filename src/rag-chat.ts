import type { Callbacks } from "@langchain/core/callbacks/manager";
import type { BaseMessage } from "@langchain/core/messages";
import { RunnableSequence, RunnableWithMessageHistory } from "@langchain/core/runnables";
import { LangChainStream, StreamingTextResponse } from "ai";
import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { PromptTemplate } from "@langchain/core/prompts";

import { HistoryService } from "./services/history";
import { RetrievalService } from "./services/retrieval";
import { RateLimitService } from "./services/ratelimit";
import type { RetrievePayload } from "./services/retrieval";

import { QA_TEMPLATE } from "./prompts";

import { UpstashModelError } from "./error/model";
import { RatelimitUpstashError } from "./error/ratelimit";

import type { ChatOptions, PrepareChatResult, RAGChatConfig } from "./types";
import { ClientFactory } from "./client-factory";
import { Config } from "./config";
import { appendDefaultsIfNeeded, formatChatHistory, sanitizeQuestion } from "./utils";

type CustomInputValues = { chat_history?: BaseMessage[]; question: string; context: string };

export class RAGChat {
  private retrievalService: RetrievalService;
  private historyService: HistoryService;
  private ratelimitService: RateLimitService;

  private model: BaseLanguageModelInterface;
  private template: PromptTemplate;

  constructor(
    retrievalService: RetrievalService,
    historyService: HistoryService,
    ratelimitService: RateLimitService,
    config: { model: BaseLanguageModelInterface; template: PromptTemplate }
  ) {
    this.retrievalService = retrievalService;
    this.historyService = historyService;
    this.ratelimitService = ratelimitService;

    this.model = config.model;
    this.template = config.template;
  }

  private async prepareChat({
    question: input,
    similarityThreshold,
    topK,
  }: RetrievePayload): Promise<PrepareChatResult> {
    const question = sanitizeQuestion(input);
    const facts = await this.retrievalService.retrieveFromVectorDb({
      question,
      similarityThreshold,
      topK,
    });
    return { question, facts };
  }

  async chat(
    input: string,
    options: ChatOptions
  ): Promise<StreamingTextResponse | Record<string, unknown>> {
    // Adds chat session id and ratelimit session id if not provided.
    const options_ = appendDefaultsIfNeeded(options);

    //Checks ratelimit of the user. If not enabled `success` will be always true.
    const { success, resetTime } = await this.ratelimitService.checkLimit(
      options_.ratelimitSessionId
    );

    if (!success) {
      throw new RatelimitUpstashError("Couldn't process chat due to ratelimit.", {
        error: "ERR:USER_RATELIMITED",
        resetTime: resetTime,
      });
    }

    //Sanitizes the given input by stripping all the newline chars then queries vector db with sanitized question.
    const { question, facts } = await this.prepareChat({
      question: input,
      similarityThreshold: options.similarityThreshold,
      topK: options.topK,
    });

    return options.stream
      ? this.streamingChainCall(options_, question, facts)
      : this.chainCall(options_, question, facts);
  }

  private streamingChainCall = (
    chatOptions: ChatOptions,
    question: string,
    facts: string
  ): StreamingTextResponse => {
    const { stream, handlers } = LangChainStream();
    void this.chainCall(chatOptions, question, facts, [handlers]);
    return new StreamingTextResponse(stream, {});
  };

  private chainCall(
    chatOptions: ChatOptions,
    question: string,
    facts: string,
    handlers?: Callbacks
  ) {
    const formattedHistoryChain = RunnableSequence.from<CustomInputValues>([
      {
        chat_history: (input) => formatChatHistory(input.chat_history ?? []),
        question: (input) => input.question,
        context: (input) => input.context,
      },
      this.template,
      this.model,
    ]);

    const chainWithMessageHistory = new RunnableWithMessageHistory({
      runnable: formattedHistoryChain,
      getMessageHistory: (sessionId: string) =>
        this.historyService.getMessageHistory({
          sessionId,
          length: chatOptions.includeHistory,
        }),
      inputMessagesKey: "question",
      historyMessagesKey: "chat_history",
    });

    return chainWithMessageHistory.invoke(
      {
        question,
        context: facts,
      },
      {
        callbacks: handlers ?? undefined,
        configurable: { sessionId: chatOptions.sessionId },
      }
    );
  }

  /**
   *  Prepares RAG Chat by creating or getting Redis, Vector and Ratelimit instances.
   */
  static async initialize(
    config: RAGChatConfig & { email: string; token: string }
  ): Promise<RAGChat> {
    const clientFactory = new ClientFactory(
      new Config(config.email, config.token, {
        redis: config.redis,
        region: config.region,
        vector: config.vector,
      })
    );
    const { vector: index, redis } = await clientFactory.init({ redis: true, vector: true });

    const historyService = new HistoryService(redis);
    const retrievalService = new RetrievalService(index);
    const ratelimitService = new RateLimitService(config.ratelimit);

    if (!config.model) {
      throw new UpstashModelError("Model can not be undefined!");
    }

    return new RAGChat(retrievalService, historyService, ratelimitService, {
      model: config.model,
      template: config.template ?? QA_TEMPLATE,
    });
  }
}
