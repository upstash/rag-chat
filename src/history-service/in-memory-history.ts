/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable no-var */
import { DEFAULT_CHAT_SESSION_ID, DEFAULT_HISTORY_LENGTH } from "../constants";
import type { UpstashDict, UpstashMessage } from "../types";
import type { BaseMessageHistory, HistoryAddMessage } from "./base-message-history";

//TODO: Josh lets document this type with comments.
declare global {
  var store: Record<
    string,
    {
      messages: Omit<UpstashMessage, "id">[];
    }
  >;
}

export type InMemoryHistoryConfig = {
  sessionId: string;
  sessionTTL?: number;
  topLevelChatHistoryLength?: number;
  metadata?: UpstashDict;
};

export class InMemoryHistory implements BaseMessageHistory {
  constructor() {
    if (!global.store) global.store = {};
  }

  async addMessage({
    message,
    sessionId = DEFAULT_CHAT_SESSION_ID,
    sessionTTL: _,
  }: HistoryAddMessage): Promise<void> {
    if (!global.store[sessionId]) {
      global.store[sessionId] = { messages: [] };
    }

    const oldMessages = global.store[sessionId].messages || [];
    const newMessages = [
      {
        ...message,
        // __internal_order: oldMessages.length,
      },
      ...oldMessages,
    ];

    global.store[sessionId].messages = newMessages;
  }

  async deleteMessages({ sessionId }: { sessionId: string }): Promise<void> {
    if (!global.store[sessionId]) {
      return;
    }

    global.store[sessionId].messages = [];
  }

  async getMessages({
    sessionId = DEFAULT_CHAT_SESSION_ID,
    amount = DEFAULT_HISTORY_LENGTH,
  }): Promise<UpstashMessage[]> {
    if (!global.store[sessionId]) {
      global.store[sessionId] = { messages: [] };
    }

    const messages = global.store[sessionId]?.messages ?? [];

    const sortedMessages = messages.slice(0, amount).reverse();
    const messagesWithId = sortedMessages.map((message, index) => ({
      ...message,
      id: index.toString(),
    }));

    return messagesWithId;
  }
}
