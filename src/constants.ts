export const DEFAULT_CHAT_SESSION_ID = "upstash-rag-chat-session";
export const DEFAULT_CHAT_RATELIMIT_SESSION_ID = "upstash-rag-chat-ratelimit-session";

export const RATELIMIT_ERROR_MESSAGE = "ERR:USER_RATELIMITED";

export const DEFAULT_VECTOR_DB_NAME = "upstash-rag-chat-vector";
export const DEFAULT_REDIS_DB_NAME = "upstash-rag-chat-redis";

//Retrieval related default options
export const DEFAULT_SIMILARITY_THRESHOLD = 0.5;
export const DEFAULT_TOP_K = 5;
export const DEFAULT_METADATA_KEY = "text";

//History related default options
export const DEFAULT_HISTORY_TTL = 86_400;
export const DEFAULT_HISTORY_LENGTH = 5;
