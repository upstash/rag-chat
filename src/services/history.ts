import type { Redis } from "@upstash/redis";
import { CustomUpstashRedisChatMessageHistory } from "./redis-custom-history";

type GetHistory = { sessionId: string; length?: number; sessionTTL?: number };

export class HistoryService {
  private redis: Redis;
  constructor(redis: Redis) {
    this.redis = redis;
  }

  getMessageHistory({ length, sessionId, sessionTTL }: GetHistory) {
    return new CustomUpstashRedisChatMessageHistory({
      sessionId,
      sessionTTL,
      topLevelChatHistoryLength: length,
      client: this.redis,
    });
  }
}
