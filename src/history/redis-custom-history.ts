/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import type { BaseMessage, StoredMessage } from "@langchain/core/messages";
import {
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";
import { Redis, type RedisConfigNodejs } from "@upstash/redis";

//REFER HERE: https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-community/src/stores/message/upstash_redis.ts
/**
 * Type definition for the input parameters required to initialize an
 * instance of the UpstashRedisChatMessageHistory class.
 */
export type CustomUpstashRedisChatMessageHistoryInput = {
  sessionId: string;
  sessionTTL?: number;
  config?: RedisConfigNodejs;
  client?: Redis;
  topLevelChatHistoryLength?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Class used to store chat message history in Redis. It provides methods
 * to add, get, and clear messages.
 */
export class CustomUpstashRedisChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "upstash_redis"];

  get lc_secrets() {
    return {
      "config.url": "UPSTASH_REDIS_REST_URL",
      "config.token": "UPSTASH_REDIS_REST_TOKEN",
    };
  }

  public client: Redis;

  private sessionId: string;
  private metadata?: Record<string, unknown>;

  private sessionTTL?: number;
  private topLevelChatHistoryLength?: number;

  constructor(fields: CustomUpstashRedisChatMessageHistoryInput) {
    super(fields);
    const { sessionId, sessionTTL, config, client, topLevelChatHistoryLength, metadata } = fields;
    if (client) {
      this.client = client;
    } else if (config) {
      this.client = new Redis(config);
    } else {
      throw new Error(
        `Upstash Redis message stores require either a config object or a pre-configured client.`
      );
    }

    this.sessionId = sessionId;
    this.metadata = metadata;
    this.sessionTTL = sessionTTL;
    this.topLevelChatHistoryLength = topLevelChatHistoryLength;
  }

  /**
   * Retrieves the chat messages from the Redis database.
   * @returns An array of BaseMessage instances representing the chat history.
   */
  async getMessages(): Promise<BaseMessage[]> {
    const length = this.topLevelChatHistoryLength ?? [0, -1];

    const rawStoredMessages: StoredMessage[] = await this.client.lrange<StoredMessage>(
      this.sessionId,
      typeof length === "number" ? 0 : length[0],
      typeof length === "number" ? length : length[1]
    );

    const orderedMessages = rawStoredMessages.reverse();
    const previousMessages = orderedMessages.filter(
      (x): x is StoredMessage => x.type !== undefined && x.data.content !== undefined
    );
    return mapStoredMessagesToChatMessages(previousMessages);
  }

  /**
   * Adds a new message to the chat history in the Redis database.
   * @param message The message to be added to the chat history.
   * @returns Promise resolving to void.
   */
  async addMessage(message: BaseMessage): Promise<void> {
    message.response_metadata = {
      ...message.response_metadata,
      ...this.metadata,
    };
    const messageToAdd = mapChatMessagesToStoredMessages([message]);

    await this.client.lpush(this.sessionId, JSON.stringify(messageToAdd[0]));
    if (this.sessionTTL) {
      await this.client.expire(this.sessionId, this.sessionTTL);
    }
  }

  /**
   * Deletes all messages from the chat history in the Redis database.
   * @returns Promise resolving to void.
   */
  async clear(): Promise<void> {
    await this.client.del(this.sessionId);
  }
}
