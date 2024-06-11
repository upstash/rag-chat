/* eslint-disable @typescript-eslint/require-await */
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import type { BaseMessage } from "@langchain/core/messages";

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
  async getMessages(): Promise<BaseMessage[]> {
    return this.topLevelChatHistoryLength
      ? this.messages.slice(1).slice(-this.topLevelChatHistoryLength)
      : this.messages;
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
