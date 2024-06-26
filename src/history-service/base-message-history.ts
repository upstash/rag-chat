import type { UpstashMessage } from "../types";

export type HistoryAddMessage = {
  message: Omit<UpstashMessage, "id">;
  sessionId?: string;
  sessionTTL?: number;
};

export abstract class BaseMessageHistory {
  abstract getMessages({
    sessionId,
    amount,
  }: {
    sessionId: string;
    amount: number;
  }): Promise<UpstashMessage[]>;
  abstract addMessage(data: HistoryAddMessage): Promise<void>;
  abstract deleteMessages({ sessionId }: { sessionId: string }): Promise<void>;
}
