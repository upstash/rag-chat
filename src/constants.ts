import type { PreferredRegions } from "./types";

export const DEFAULT_CHAT_SESSION_ID = "upstash-rag-chat-session";
export const DEFAULT_CHAT_RATELIMIT_SESSION_ID = "upstash-rag-chat-ratelimit-session";

export const RATELIMIT_ERROR_MESSAGE = "ERR:USER_RATELIMITED";

export const DEFAULT_VECTOR_DB_NAME = "upstash-rag-chat-vector";
export const DEFAULT_REDIS_DB_NAME = "upstash-rag-chat-redis";
export const PREFERRED_REGION: PreferredRegions = "us-east-1";
