/* eslint-disable @typescript-eslint/require-await */
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import type { BaseMessage } from "@langchain/core/messages";

export class CustomInMemoryChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "in_memory"];

  private messages: BaseMessage[] = [];
  private topLevelChatHistoryLength?: number;

  constructor(messages?: BaseMessage[], topLevelChatHistoryLength?: number) {
    // eslint-disable-next-line prefer-rest-params
    super(...arguments);
    this.messages = messages ?? [];
    this.topLevelChatHistoryLength = topLevelChatHistoryLength;
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
    this.messages.push(message);
  }

  /**
   * Method to clear all the messages from the ChatMessageHistory instance.
   * @returns A promise that resolves when all messages have been cleared.
   */
  async clear() {
    this.messages = [];
  }
}
