import type { CustomPrompt } from "./rag-chat-base";

export const DEFAULT_CHAT_SESSION_ID = "upstash-rag-chat-session";
export const DEFAULT_CHAT_RATELIMIT_SESSION_ID = "upstash-rag-chat-ratelimit-session";

export const RATELIMIT_ERROR_MESSAGE = "ERR:USER_RATELIMITED";

export const DEFAULT_VECTOR_DB_NAME = "upstash-rag-chat-vector";
export const DEFAULT_REDIS_DB_NAME = "upstash-rag-chat-redis";

//Retrieval related default options
export const DEFAULT_SIMILARITY_THRESHOLD = 0.5;
export const DEFAULT_TOP_K = 5;

//History related default options
export const DEFAULT_HISTORY_TTL = 86_400;
export const DEFAULT_HISTORY_LENGTH = 5;

//We need that constant to split creator LLM such as `ChatOpenAI_gpt-3.5-turbo`. Format is `provider_modelName`.
export const MODEL_NAME_WITH_PROVIDER_SPLITTER = "_";

//We need to make sure namespace is not undefined, but "". This will force vector-db to query default namespace.
export const DEFAULT_NAMESPACE = "";

export const DEFAULT_PROMPT: CustomPrompt = ({ context, question, chatHistory }) =>
  `You are a friendly AI assistant whose job is to help users by answering their questions. To help you answer the questions, a context and chat history will be provided.

  To answer, use the information available in the context or in the chat history, either one works. If the answer is not available in both the chat history and the context, politely inform the user that you cannot answer the question.

  -------------
  Chat history:
  ${chatHistory}
  -------------
  Context:
  ${context}
  -------------

  Question: ${question}
  Helpful answer:`;
