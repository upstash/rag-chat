import type { Redis } from "@upstash/redis";
import { CustomInMemoryChatMessageHistory } from "./in-memory-custom-history";
import { CustomUpstashRedisChatMessageHistory } from "./redis-custom-history";
import { InternalUpstashError } from "../error";

type GetHistory = { sessionId: string; length?: number; sessionTTL?: number };

export class History {
  private redis?: Redis;
  private inMemoryChatHistory?: CustomInMemoryChatMessageHistory;

  constructor(redis?: Redis) {
    this.redis = redis;
    if (!redis) {
      this.inMemoryChatHistory = new CustomInMemoryChatMessageHistory();
    }
  }

  getMessageHistory({ length, sessionId, sessionTTL }: GetHistory) {
    try {
      if (this.redis) {
        return new CustomUpstashRedisChatMessageHistory({
          sessionId,
          sessionTTL,
          topLevelChatHistoryLength: length,
          client: this.redis,
        });
      }
    } catch (error) {
      throw new InternalUpstashError(
        `Could not retrieve message history. Details: ${(error as Error).message}`
      );
    }
    if (this.inMemoryChatHistory) {
      return this.inMemoryChatHistory;
    }
    throw new InternalUpstashError("Could not initialize in-memoroy chat history.");
  }
}
