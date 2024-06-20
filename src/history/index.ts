import type { Redis } from "@upstash/redis";
import { __InMemoryHistory } from "./__in-memory-history";
import { __UpstashRedisHistory } from "./__redis-custom-history";

type HistoryConfig = {
  redis?: Redis;
  metadata?: Record<string, unknown>;
};

export type GetHistoryOptions = { sessionId: string; length?: number; sessionTTL?: number };

export class History {
  private redis?: Redis;
  private metadata?: Record<string, unknown>;
  service: __UpstashRedisHistory | __InMemoryHistory;

  constructor(fields?: HistoryConfig) {
    const { metadata, redis } = fields ?? {};

    this.service = redis
      ? new __UpstashRedisHistory({
          client: this.redis,
          metadata: this.metadata,
        })
      : new __InMemoryHistory();

    this.redis = redis;
    this.metadata = metadata;
  }
}
