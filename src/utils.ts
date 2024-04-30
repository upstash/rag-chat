import type { BaseMessage } from "@langchain/core/messages";

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
