import { ChatOpenAI } from "@langchain/openai";

export type OpenAIChatModel =
  | "gpt-4-turbo"
  | "gpt-4-turbo-2024-04-09"
  | "gpt-4-0125-preview"
  | "gpt-4-turbo-preview"
  | "gpt-4-1106-preview"
  | "gpt-4-vision-preview"
  | "gpt-4"
  | "gpt-4o"
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

export type LLMClientConfig = {
  model: string;
  apiKey: string;
  maxTokens?: number;
  stop?: string[];
  topP?: number;
  temperature?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  n?: number;
  logitBias?: Record<string, number>;
  logProbs?: number;
  topLogprobs?: number;
  baseUrl: string;
};

type ModelOptions = Omit<LLMClientConfig, "model">;

export const upstash = (model: UpstashChatModel, options?: Omit<ModelOptions, "baseUrl">) => {
  const apiKey = options?.apiKey ?? process.env.QSTASH_TOKEN ?? "";
  if (!apiKey) {
    throw new Error(
      "Failed to create upstash LLM client: QSTASH_TOKEN not found." +
        " Pass apiKey parameter or set QSTASH_TOKEN env variable."
    );
  }

  return new ChatOpenAI({
    modelName: model,
    apiKey,
    ...options,
    streamUsage: false,
    configuration: {
      baseURL: "https://qstash.upstash.io/llm/v1",
    },
  });
};

export const custom = (model: string, options?: ModelOptions, helicone?: { token: string }) => {
  if (!options?.baseUrl) throw new Error("baseUrl cannot be empty or undefined.");

  return new ChatOpenAI({
    modelName: model,
    ...options,
    ...(helicone
      ? {
          configuration: {
            baseURL: "https://gateway.helicone.ai",
            defaultHeaders: {
              "Helicone-Auth": `Bearer ${helicone.token}`,
              "Helicone-Target-Url": options.baseUrl,
              Authorization: `Bearer ${options.apiKey}`,
            },
          },
        }
      : {
          configuration: {
            apiKey: options.apiKey,
            baseURL: options.baseUrl,
          },
        }),
  });
};

export const openai = (
  model: OpenAIChatModel,
  options?: Omit<ModelOptions, "baseUrl">,
  helicone?: { token: string }
) => {
  return new ChatOpenAI({
    modelName: model,
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY ?? options?.apiKey ?? "",
    ...(helicone
      ? {
          configuration: {
            basePath: "https://oai.helicone.ai/v1",
            defaultHeaders: {
              "Helicone-Auth": `Bearer ${helicone.token}`,
            },
          },
        }
      : {}),
    ...options,
  });
};
