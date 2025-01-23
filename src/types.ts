import type { ChatOpenAI } from "@langchain/openai";
import type { openai } from "@ai-sdk/openai";
import type { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import type { Index, QueryMode } from "@upstash/vector";
import type { CustomPrompt } from "./rag-chat";
import type { ChatMistralAI } from "@langchain/mistralai";
import type { ChatAnthropic } from "@langchain/anthropic";

declare const __brand: unique symbol;
type Brand<B> = { [__brand]: B };
export type Branded<T, B> = T & Brand<B>;
type OptionalAsync<T> = T | Promise<T>;

export type ChatOptions = {
  /** Length of the conversation history to include in your LLM query. Increasing this may lead to hallucinations. Retrieves the last N messages.
   * @default 5
   */
  historyLength?: number;

  /** Configuration to retain chat history. After the specified time, the history will be automatically cleared.
   * @default 86_400 // 1 day in seconds
   */
  historyTTL?: number;

  /** Configuration to adjust the accuracy of results.
   * @default 0.5
   */
  similarityThreshold?: number;
  /** Amount of data points to include in your LLM query.
   * @default 5
   */
  topK?: number;

  /**
   *  Details of applied rate limit.
   */
  ratelimitDetails?: (response: Awaited<ReturnType<Ratelimit["limit"]>>) => void;

  /**
   * Hook to modify or get data and details of each chunk. Can be used to alter streamed content.
   */
  onChunk?: ({
    content,
    inputTokens,
    chunkTokens,
    totalTokens,
    rawContent,
  }: {
    inputTokens: number;
    chunkTokens: number;
    totalTokens: number;
    content: string;
    rawContent: string;
  }) => void;

  /**
   * Hook to access the retrieved context and modify as you wish.
   */
  onContextFetched?: (
    context: PrepareChatResult
  ) => OptionalAsync<PrepareChatResult> | OptionalAsync<undefined | null>;

  /**
   * Hook to access the retrieved history and modify as you wish.
   */
  onChatHistoryFetched?: (
    messages: UpstashMessage[]
  ) => OptionalAsync<UpstashMessage[]> | OptionalAsync<undefined | null>;

  /**
   * Allows disabling RAG and use chat as LLM in combination with prompt. This will give you ability to build your own pipelines.
   */
  disableRAG?: boolean;

  /**
   * Disables recording of the conversation in the chat history.
   * @default false
   */
  disableHistory?: boolean;

  /**
   * Embedding to use when fetching context.
   *
   * Must be provided if the Vector Database doesn't have default embeddings.
   */
  embedding?: number[];

  /**
   * Allows filtering metadata from the vector database.
   * @example "population >= 1000000 AND geography.continent = 'Asia'"
   * https://upstash.com/docs/vector/features/filtering#metadata-filtering
   */
  contextFilter?: string;

  /**
   * Hook to access the final response
   */
  onFinish?: ({ output }: { output: string }) => void;
  /*
   * Query mode to use when querying a hybrid index.
   *
   * This is useful if your index is a hybrid index and you want to query the
   * sparse or dense part when you pass `data`.
   */
  queryMode?: QueryMode;
} & CommonChatAndRAGOptions;

export type PrepareChatResult = { data: string; id: string; metadata: unknown }[];

/**Config needed to initialize RAG Chat SDK */
export type RAGChatConfig = {
  vector?: Index;
  redis?: Redis;
  /**Any valid Langchain compatiable LLM will work
   * @example new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: true,
      verbose,
      temperature: 0,
      apiKey,
    })
  */

  model?: ChatOpenAI | ChatMistralAI | ChatAnthropic | OpenAIChatLanguageModel;
  /**
     * Ratelimit instance
     * @example new Ratelimit({
          redis,
          limiter: Ratelimit.tokenBucket(10, "1d", 10),
          prefix: "@upstash/rag-chat-ratelimit",
          })
     */
  ratelimit?: Ratelimit;

  /**
   * Logs every step of the chat, including sending prompts, listing history entries,
   * retrieving context from the vector database, and capturing the full response
   * from the LLM, including latency.
   */
  debug?: boolean;
} & CommonChatAndRAGOptions;

export type AddContextOptions = {
  /**
   * Namespace of the index you wanted to insert. Default is empty string.
   * @default ""
   */

  metadata?: UpstashDict;
  namespace?: string;
};

export type CommonChatAndRAGOptions = {
  /** Set to `true` if working with web apps and you want to be interactive without stalling users.
   */
  streaming?: true | false;

  /** Chat session ID of the user interacting with the application.
   * @default "upstash-rag-chat-session"
   */
  sessionId?: string;
  /**
   * Namespace of the index you wanted to query.
   */
  namespace?: string;

  /**
   * Metadata for your chat message. This could be used to store anything in the chat history. By default RAG Chat SDK uses this to persist used model name in the history
   */
  metadata?: UpstashDict;

  /** Rate limit session ID of the user interacting with the application.
   * @default "upstash-rag-chat-ratelimit-session"
   */
  ratelimitSessionId?: string;
  /**
     * If no Index name or instance is provided, falls back to the default.
     * @default
          PromptTemplate.fromTemplate(`You are a friendly AI assistant augmented with an Upstash Vector Store.
          To help you answer the questions, a context will be provided. This context is generated by querying the vector store with the user question.
          Answer the question at the end using only the information available in the context and chat history.
          If the answer is not available in the chat history or context, do not answer the question and politely let the user know that you can only answer if the answer is available in context or the chat history.

          -------------
          Chat history:
          {chat_history}
          -------------
          Context:
          {context}
          -------------

          Question: {question}
          Helpful answer:`)
     */
  promptFn?: CustomPrompt;
};

export type HistoryOptions = Pick<ChatOptions, "historyLength" | "sessionId">;

export type UpstashDict = Record<string, unknown>;

export type UpstashMessage<TMetadata extends UpstashDict = UpstashDict> = {
  role: "assistant" | "user";
  content: string;
  metadata?: TMetadata | undefined;
  usage_metadata?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  id: string;
};

export type OpenAIChatLanguageModel = ReturnType<typeof openai>;
