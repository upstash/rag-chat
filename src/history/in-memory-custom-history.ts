/* eslint-disable @typescript-eslint/require-await */
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import type { BaseMessage } from "@langchain/core/messages";
import type { UpstashDict, UpstashMessage } from "../types";
import { mapLangchainMessageToUpstashMessages } from "./utils";

export type CustomInMemoryChatMessageHistoryInput = {
  messages?: BaseMessage[];
  topLevelChatHistoryLength?: number;
  metadata?: Record<string, unknown>;
};

export class CustomInMemoryChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "in_memory"];

  private messages: BaseMessage[] = [];
  private topLevelChatHistoryLength?: number;
  private metadata?: Record<string, unknown>;

  constructor(fields: CustomInMemoryChatMessageHistoryInput) {
    const { metadata, messages, topLevelChatHistoryLength } = fields;
    // eslint-disable-next-line prefer-rest-params
    super(...arguments);
    this.messages = messages ?? [];
    this.topLevelChatHistoryLength = topLevelChatHistoryLength;
    this.metadata = metadata;
  }

  /**
   * Method to get all the messages stored in the ChatMessageHistory
   * instance.
   * @returns Array of stored BaseMessage instances.
   */
  async getMessages(options?: { offset?: number; length?: number }): Promise<BaseMessage[]> {
    if (options) {
      const start = options.offset ?? 0;
      const length = options.length ?? 0;
      const end = start + length + 1;

      const reversedMessages = [...this.messages].reverse();
      const slicedMessages = reversedMessages.slice(start, end);

      return slicedMessages;
    } else if (this.topLevelChatHistoryLength) {
      return this.messages.slice(1).slice(-this.topLevelChatHistoryLength);
    } else {
      return this.messages.reverse();
    }
  }

  /**
   * Retrieves the mapped chat messages from the Upstash Redis database .
   * @returns An array of UpstashMessages instances representing the chat history.
   */
  async getMessagesForUpstash<TMetadata extends UpstashDict = UpstashDict>(options?: {
    offset?: number;
    length?: number;
  }): Promise<UpstashMessage<TMetadata>[]> {
    if (options) {
      const start = options.offset ?? 0;
      const length = options.length ?? 0;
      const end = start + length + 1;

      const reversedMessages = [...this.messages].reverse();
      const slicedMessages = reversedMessages.slice(start, end);

      return mapLangchainMessageToUpstashMessages<TMetadata>(slicedMessages.reverse());
    } else if (this.topLevelChatHistoryLength) {
      return mapLangchainMessageToUpstashMessages<TMetadata>(
        this.messages.slice(1).slice(-this.topLevelChatHistoryLength)
      );
    } else {
      return mapLangchainMessageToUpstashMessages<TMetadata>(this.messages.reverse());
    }
  }

  /**
   * Method to add a new message to the ChatMessageHistory instance.
   * @param message The BaseMessage instance to add.
   * @returns A promise that resolves when the message has been added.
   */
  async addMessage(message: BaseMessage) {
    //@ts-expect-error This our way of mutating Message object to store model name with providers.
    this.messages.push({ ...message, response_metadata: this.metadata });
  }

  /**
   * Method to clear all the messages from the ChatMessageHistory instance.
   * @returns A promise that resolves when all messages have been cleared.
   */
  async clear() {
    this.messages = [];
  }
}
