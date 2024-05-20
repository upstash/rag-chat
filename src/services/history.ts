import type { Redis } from "@upstash/sdk";
import { CustomUpstashRedisChatMessageHistory } from "./redis-custom-history";
import { Config } from "../config";
import { ClientFactory } from "../client-factory";
import type { RAGChatConfig } from "../types";

type GetHistory = { sessionId: string; length?: number; sessionTTL?: number };
type HistoryInit = Omit<RAGChatConfig, "model" | "template" | "vector"> & {
  email: string;
  token: string;
} & GetHistory;

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

  public static async init(config: HistoryInit) {
    const clientFactory = new ClientFactory(
      new Config(config.email, config.token, {
        redis: config.redis,
        region: config.region,
      })
    );
    const { redis } = await clientFactory.init({ redis: true });
    return new HistoryService(redis).getMessageHistory(config);
  }
}
