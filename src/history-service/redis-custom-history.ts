import type { RedisConfigNodejs } from "@upstash/redis";
import { Redis } from "@upstash/redis";
import { DEFAULT_CHAT_SESSION_ID, DEFAULT_HISTORY_LENGTH } from "../constants";
import type { UpstashMessage } from "../types";
import type { BaseMessageHistory, HistoryAddMessage } from "./base-message-history";

export type UpstashRedisHistoryConfig = {
  config?: RedisConfigNodejs;
  client?: Redis;
};

export class UpstashRedisHistory implements BaseMessageHistory {
  public client: Redis;

  constructor(_config: UpstashRedisHistoryConfig) {
    const { config, client } = _config;

    if (client) {
      this.client = client;
    } else if (config) {
      this.client = new Redis(config);
    } else {
      throw new Error(
        `Upstash Redis message stores require either a config object or a pre-configured client.`
      );
    }
  }

  async addMessage({
    message,
    sessionId = DEFAULT_CHAT_SESSION_ID,
    sessionTTL,
  }: HistoryAddMessage): Promise<void> {
    await this.client.lpush(sessionId, JSON.stringify(message));

    if (sessionTTL) {
      await this.client.expire(sessionId, sessionTTL);
    }
  }

  async deleteMessages({ sessionId }: { sessionId: string }): Promise<void> {
    await this.client.del(sessionId);
  }

  async getMessages({
    sessionId = DEFAULT_CHAT_SESSION_ID,
    amount = DEFAULT_HISTORY_LENGTH,
    startIndex = 0,
  }): Promise<UpstashMessage[]> {
    const endIndex = startIndex + amount - 1;

    const storedMessages: UpstashMessage[] = await this.client.lrange<UpstashMessage>(
      sessionId,
      startIndex,
      endIndex
    );

    const orderedMessages = storedMessages.reverse();
    const messagesWithIndex: UpstashMessage[] = orderedMessages.map((message, index) => ({
      ...message,
      id: (startIndex + index).toString(),
    }));

    return messagesWithIndex;
  }
}
