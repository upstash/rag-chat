import { ChatOpenAI } from "@langchain/openai";
import type { UpstashLLMClientConfig } from "./upstash-llm-client";
import { UpstashLLMClient } from "./upstash-llm-client";

export type OpenAIChatModel =
  | "gpt-4-turbo"
  | "gpt-4-turbo-2024-04-09"
  | "gpt-4-0125-preview"
  | "gpt-4-turbo-preview"
  | "gpt-4-1106-preview"
  | "gpt-4-vision-preview"
  | "gpt-4"
  | "gpt-4-0314"
  | "gpt-4-0613"
  | "gpt-4-32k"
  | "gpt-4-32k-0314"
  | "gpt-4-32k-0613"
  | "gpt-3.5-turbo"
  | "gpt-3.5-turbo-16k"
  | "gpt-3.5-turbo-0301"
  | "gpt-3.5-turbo-0613"
  | "gpt-3.5-turbo-1106"
  | "gpt-3.5-turbo-0125"
  | "gpt-3.5-turbo-16k-0613";

export type UpstashChatModel =
  | "mistralai/Mistral-7B-Instruct-v0.2"
  | "meta-llama/Meta-Llama-3-8B-Instruct";

export const upstashModel = (
  model: UpstashChatModel,
  options?: Omit<UpstashLLMClientConfig, "model">
) => {
  return new UpstashLLMClient({
    model,
    apiKey: process.env.QSTASH_TOKEN ?? options?.apiKey ?? "",
    ...options,
  });
};

export const openaiModel = (
  model: OpenAIChatModel,
  options?: Omit<UpstashLLMClientConfig, "model">
) => {
  return new ChatOpenAI({
    modelName: model,
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY ?? options?.apiKey ?? "",
    ...options,
  });
};
