import type { Redis } from "@upstash/sdk";
import { CustomUpstashRedisChatMessageHistory } from "./redis-custom-history";
import type { RAGChatConfig } from "../config";
import { Config } from "../config";
import { ClientFactory } from "../client-factory";

const DAY_IN_SECONDS = 86_400;
const TOP_6 = 5;

type GetHistory = { sessionId: string; length?: number };
type HistoryInit = Omit<RAGChatConfig, "model" | "template" | "vector"> & {
  email: string;
  token: string;
} & GetHistory;

export class HistoryService {
  private redis: Redis;
  constructor(redis: Redis) {
    this.redis = redis;
  }

  getMessageHistory({ length = TOP_6, sessionId }: GetHistory) {
    return new CustomUpstashRedisChatMessageHistory({
      sessionId,
      sessionTTL: DAY_IN_SECONDS,
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
