import type { Redis } from "@upstash/redis";
import { CustomInMemoryChatMessageHistory } from "./in-memory-custom-history";
import { CustomUpstashRedisChatMessageHistory } from "./redis-custom-history";
import { InternalUpstashError } from "../error";
import type { UpstashDict } from "../types";

type HistoryConfig = {
  redis?: Redis;
  metadata?: Record<string, unknown>;
};

type GetHistoryOptions = {
  sessionId: string;
  length?: number;
  sessionTTL?: number;
  metadata?: UpstashDict;
};

export class History {
  private redis?: Redis;
  private inMemoryChatHistory?: CustomInMemoryChatMessageHistory;

  constructor(fields?: HistoryConfig) {
    const { redis } = fields ?? {};

    this.redis = redis;
  }

  getMessageHistory({ length, sessionId, sessionTTL, metadata }: GetHistoryOptions) {
    try {
      if (this.redis) {
        return new CustomUpstashRedisChatMessageHistory({
          sessionId,
          sessionTTL,
          topLevelChatHistoryLength: length,
          client: this.redis,
          metadata,
        });
      }
    } catch (error) {
      throw new InternalUpstashError(
        `Could not retrieve message history. Details: ${(error as Error).message}`
      );
    }
    if (this.inMemoryChatHistory) {
      return this.inMemoryChatHistory;
    } else {
      this.inMemoryChatHistory = new CustomInMemoryChatMessageHistory({
        metadata,
        topLevelChatHistoryLength: length,
      });
    }

    throw new InternalUpstashError("Could not initialize in-memoroy chat history.");
  }
}
