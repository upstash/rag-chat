import type { BaseMessage } from "@langchain/core/messages";
import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { CustomPrompt } from "./rag-chat";
import type { ChatOptions, OpenAIChatLanguageModel } from "./types";
import { ChatAnthropic } from "@langchain/anthropic";

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
  disableHistory: boolean;
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

const DEFAULT_DELAY = 20_000;
export function delay(ms = DEFAULT_DELAY): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isOpenAIChatLanguageModel(
  model: BaseLanguageModelInterface | OpenAIChatLanguageModel | ChatAnthropic
): model is OpenAIChatLanguageModel {
  return (
    Object.prototype.hasOwnProperty.call(model, "specificationVersion") &&
    !isAnthropicChatLanguageModel(model)
  );
}

export function isAnthropicChatLanguageModel(
  model: BaseLanguageModelInterface | OpenAIChatLanguageModel | ChatAnthropic
): model is ChatAnthropic {
  return model instanceof ChatAnthropic;
}
