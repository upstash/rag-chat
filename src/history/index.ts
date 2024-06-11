import type { Redis } from "@upstash/redis";
import { CustomInMemoryChatMessageHistory } from "./in-memory-custom-history";
import { CustomUpstashRedisChatMessageHistory } from "./redis-custom-history";
import { InternalUpstashError } from "../error";

type HistoryConfig = {
  redis?: Redis;
  metadata?: Record<string, unknown>;
};

export type GetHistoryOptions = { sessionId: string; length?: number; sessionTTL?: number };

export class History {
  private redis?: Redis;
  private metadata?: Record<string, unknown>;
  private inMemoryChatHistory?: CustomInMemoryChatMessageHistory;

  constructor(fields?: HistoryConfig) {
    const { metadata, redis } = fields ?? {};

    this.redis = redis;
    this.metadata = metadata;

    if (!redis) {
      this.inMemoryChatHistory = new CustomInMemoryChatMessageHistory({ metadata });
    }
  }

  getMessageHistory({ length, sessionId, sessionTTL }: GetHistoryOptions) {
    try {
      if (this.redis) {
        return new CustomUpstashRedisChatMessageHistory({
          sessionId,
          sessionTTL,
          topLevelChatHistoryLength: length,
          client: this.redis,
          metadata: this.metadata,
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
