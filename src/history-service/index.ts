import type { Redis } from "@upstash/redis";
import { UpstashRedisHistory } from "./redis-custom-history";
import { InMemoryHistory } from "./in-memory-history";

type HistoryConfig = {
  redis?: Redis;
};

export type GetHistoryOptions = { sessionId: string; length?: number; sessionTTL?: number };

export class HistoryService {
  service: UpstashRedisHistory | InMemoryHistory;

  constructor(fields?: HistoryConfig) {
    this.service = fields?.redis
      ? new UpstashRedisHistory({
          client: fields.redis,
        })
      : new InMemoryHistory();
  }
}
