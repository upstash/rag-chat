import type { CustomPrompt } from "./rag-chat";

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
  `You are a friendly AI assistant augmented with an Upstash Vector Store.
  To help you answer the questions, a context and/or chat history will be provided.
  Answer the question at the end using only the information available in the context or chat history, either one is ok.

  -------------
  Chat history:
  ${chatHistory}
  -------------
  Context:
  ${context}
  -------------

  Question: ${question}
  Helpful answer:`;

export const DEFAULT_PROMPT_WITHOUT_RAG: CustomPrompt = ({ question, chatHistory }) =>
  `You are a friendly AI assistant.
    To help you answer the questions, a chat history will be provided.
    Answer the question at the end.
    -------------
    Chat history:
    ${chatHistory}
    -------------
    Question: ${question}
    Helpful answer:`;
