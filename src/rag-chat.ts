import type { Callbacks } from "@langchain/core/callbacks/manager";
import type { BaseMessage } from "@langchain/core/messages";
import { RunnableSequence, RunnableWithMessageHistory } from "@langchain/core/runnables";
import { LangChainStream, StreamingTextResponse } from "ai";

import { formatChatHistory, sanitizeQuestion } from "./utils";

import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { PromptTemplate } from "@langchain/core/prompts";
import { ClientFactory } from "./client-factory";
import { Config } from "./config";
import { HistoryService } from "./services/history";
import { RetrievalService } from "./services/retrieval";
import { QA_TEMPLATE } from "./prompts";

type CustomInputValues = { chat_history?: BaseMessage[]; question: string; context: string };

type ChatOptions = {
  stream: boolean;
  sessionId: string;
  includeHistory?: number;
  similarityThreshold?: number;
};

type PrepareChatResult = {
  question: string;
  facts: string;
};

export class RAGChat {
  private retrievalService: RetrievalService;
  private historyService: HistoryService;

  private model: BaseLanguageModelInterface;
  private template: PromptTemplate;

  constructor(
    retrievalService: RetrievalService,
    historyService: HistoryService,
    config: { model: BaseLanguageModelInterface; template: PromptTemplate }
  ) {
    this.retrievalService = retrievalService;
    this.historyService = historyService;

    this.model = config.model;
    this.template = config.template;
  }

  private async prepareChat(
    input: string,
    similarityThreshold?: number
  ): Promise<PrepareChatResult> {
    const question = sanitizeQuestion(input);
    const facts = await this.retrievalService.retrieveFromVectorDb(question, similarityThreshold);
    return { question, facts };
  }

  async chat(input: string, options: ChatOptions) {
    const { question, facts } = await this.prepareChat(input, options.similarityThreshold);

    return options.stream
      ? this.streamingChainCall(question, facts, options)
      : this.chainCall(options, question, facts);
  }

  private streamingChainCall = (question: string, facts: string, chatOptions: ChatOptions) => {
    const { stream, handlers } = LangChainStream();
    void this.chainCall(chatOptions, question, facts, [handlers]);
    return new StreamingTextResponse(stream, {});
  };

  private chainCall(
    chatOptions: { sessionId: string; includeHistory?: number },
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

  static async initialize(config: Config): Promise<RAGChat> {
    const clientFactory = new ClientFactory(
      new Config(config.email, config.token, {
        model: config.model,
        redis: config.redis,
        region: config.region,
        template: config.template,
        vector: config.vector,
      })
    );
    const { vector: index, redis } = await clientFactory.init({ redis: true, vector: true });

    const historyService = new HistoryService(redis);
    const retrievalService = new RetrievalService(index);

    return new RAGChat(retrievalService, historyService, {
      model: config.model,
      template: config.template ?? QA_TEMPLATE,
    });
  }
}
