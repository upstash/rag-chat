import type { BaseMessage } from "@langchain/core/messages";
import type { ChatOptions } from "./types";
import {
  DEFAULT_CHAT_SESSION_ID,
  DEFAULT_CHAT_RATELIMIT_SESSION_ID,
  DEFAULT_SIMILARITY_THRESHOLD,
  DEFAULT_TOP_K,
  DEFAULT_HISTORY_LENGTH,
  DEFAULT_HISTORY_TTL,
  DEFAULT_NAMESPACE,
} from "./constants";
import type { CustomPrompt } from "./rag-chat";

export const sanitizeQuestion = (question: string) => {
  return question.trim().replaceAll("\n", " ");
};

export const formatFacts = (facts: string[]): string => {
  return facts.join("\n");
};

export const formatChatHistory = (chatHistory: BaseMessage[]) => {
  const formattedDialogueTurns = chatHistory.map((dialogueTurn) =>
    dialogueTurn._getType() === "human"
      ? `Human: ${dialogueTurn.content}`
      : `Assistant: ${dialogueTurn.content}`
  );

  return formatFacts(formattedDialogueTurns);
};

type DefaultChatOptions = {
  streaming: boolean;
  disableRAG: boolean;
  sessionId: string;
  ratelimitSessionId: string;
  similarityThreshold: number;
  topK: number;
  historyLength: number;
  historyTTL: number;
  namespace: string;
  promptFn: CustomPrompt;
};
type Modify<T, R> = Omit<T, keyof R> & R;

export type ModifiedChatOptions = Modify<ChatOptions, DefaultChatOptions>;

export function appendDefaultsIfNeeded(options: ChatOptions): ModifiedChatOptions {
  const defaultValues = {
    streaming: false,
    disableRAG: false,
    sessionId: DEFAULT_CHAT_SESSION_ID,
    ratelimitSessionId: DEFAULT_CHAT_RATELIMIT_SESSION_ID,
    similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
    topK: DEFAULT_TOP_K,
    historyLength: DEFAULT_HISTORY_LENGTH,
    historyTTL: DEFAULT_HISTORY_TTL,
    namespace: DEFAULT_NAMESPACE,
    promptFn: () => "",
  };
  return {
    ...defaultValues,
    ...options,
  };
}

const DEFAULT_DELAY = 20_000;
export function delay(ms = DEFAULT_DELAY): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
