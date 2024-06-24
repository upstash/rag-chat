import type { UpstashMessage } from "../types";

export type HistoryAddMessage = {
  message: Omit<UpstashMessage, "id">;
  sessionId?: string;
  sessionTTL?: number;
};

export declare abstract class BaseMessageHistory {
  abstract getMessages({ sessionId }: { sessionId: string }): Promise<UpstashMessage[]>;
  abstract addMessage(data: HistoryAddMessage): Promise<void>;
  clear(): Promise<void>;
}
