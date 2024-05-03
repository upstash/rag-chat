import type { BaseMessage } from "@langchain/core/messages";
import type { ChatOptions } from "./types";
import { DEFAULT_CHAT_SESSION_ID, DEFAULT_CHAT_RATELIMIT_SESSION_ID } from "./constants";

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

export function appendDefaultsIfNeeded(options: ChatOptions) {
  return {
    ...options,
    sessionId: options.sessionId ?? DEFAULT_CHAT_SESSION_ID,
    ratelimitSessionId: options.ratelimitSessionId ?? DEFAULT_CHAT_RATELIMIT_SESSION_ID,
  } satisfies ChatOptions;
}
