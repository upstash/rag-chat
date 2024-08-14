import type { OpenAIChatInput } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";
import { Client as LangsmithClient } from "langsmith";
import type { OLLAMA_MODELS } from "./constants";

// Initialize global Langsmith tracer
// We use a global variable because:
// The tracer operates globally, so there's no need to pass it around.
// Initialized similar to other analytics tools (e.g., Helicone).
declare global {
  /** Langsmith tracer to trace actions in RAG Chat, its initialized in `model.ts`. */
  // eslint-disable-next-line no-var
  var globalTracer: LangsmithClient | undefined;
}

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
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  n?: number;
  logitBias?: Record<string, number>;
  model: string;
  modelKwargs?: OpenAIChatInput["modelKwargs"];
  stop?: string[];
  stopSequences?: string[];
  user?: string;
  timeout?: number;
  streamUsage?: boolean;
  maxTokens?: number;
  logprobs?: boolean;
  topLogprobs?: number;
  openAIApiKey?: string;
  apiKey?: string;
  baseUrl: string;
};

type Providers = "openai" | "upstash" | "custom" | "ollama";
type AnalyticsConfig =
  | { name: "helicone"; token: string }
  | { name: "langsmith"; token: string; apiUrl?: string };

type ModelOptions = Omit<LLMClientConfig, "model"> & {
  analytics?: AnalyticsConfig;
};

type AnalyticsSetup = {
  baseURL?: string;
  defaultHeaders?: Record<string, string | undefined>;
  client?: LangsmithClient;
};

const setupAnalytics = (
  analytics: AnalyticsConfig | undefined,
  providerApiKey: string,
  providerBaseUrl?: string,
  provider?: Providers
): AnalyticsSetup => {
  if (!analytics) return {};

  switch (analytics.name) {
    case "helicone": {
      switch (provider) {
        case "openai": {
          return {
            baseURL: "https://oai.helicone.ai/v1",
            defaultHeaders: {
              "Helicone-Auth": `Bearer ${analytics.token}`,
              Authorization: `Bearer ${providerApiKey}`,
            },
          };
        }
        case "upstash": {
          return {
            baseURL: "https://qstash.helicone.ai/llm/v1",
            defaultHeaders: {
              "Helicone-Auth": `Bearer ${analytics.token}`,
              Authorization: `Bearer ${providerApiKey}`,
            },
          };
        }
        default: {
          return {
            baseURL: "https://gateway.helicone.ai",
            defaultHeaders: {
              "Helicone-Auth": `Bearer ${analytics.token}`,
              "Helicone-Target-Url": providerBaseUrl,
              Authorization: `Bearer ${providerApiKey}`,
            },
          };
        }
      }
    }
    case "langsmith": {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (analytics.token !== undefined && analytics.token != "") {
        const client = new LangsmithClient({
          apiKey: analytics.token,
          apiUrl: analytics.apiUrl ?? "https://api.smith.langchain.com",
        });
        global.globalTracer = client;
        return { client };
      }
      return { client: undefined };
    }
    default: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      throw new Error(`Unsupported analytics provider: ${JSON.stringify(analytics)}`);
    }
  }
};

const createLLMClient = (model: string, options: ModelOptions, provider?: Providers) => {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? "";
  const providerBaseUrl = options.baseUrl;
  if (!apiKey) {
    throw new Error(
      "API key is required. Provide it in options or set OPENAI_API_KEY environment variable."
    );
  }

  const { analytics, ...restOptions } = options;
  const analyticsSetup = setupAnalytics(analytics, apiKey, providerBaseUrl, provider);

  return new ChatOpenAI({
    modelName: model,
    streamUsage: provider !== "upstash",
    temperature: 0,
    ...restOptions,
    apiKey,
    configuration: {
      baseURL: analyticsSetup.baseURL ?? providerBaseUrl,
      ...(analyticsSetup.defaultHeaders && { defaultHeaders: analyticsSetup.defaultHeaders }),
    },
  });
};

export const upstash = (model: UpstashChatModel, options?: Omit<ModelOptions, "baseUrl">) => {
  const apiKey = options?.apiKey ?? process.env.QSTASH_TOKEN ?? "";
  if (!apiKey) {
    throw new Error(
      "Failed to create upstash LLM client: QSTASH_TOKEN not found." +
        " Pass apiKey parameter or set QSTASH_TOKEN env variable."
    );
  }
  return createLLMClient(
    model,
    { ...options, apiKey, baseUrl: "https://qstash.upstash.io/llm/v1" },
    "upstash"
  );
};

export const custom = (model: string, options: ModelOptions) => {
  if (!options.baseUrl) throw new Error("baseUrl cannot be empty or undefined.");
  return createLLMClient(model, options, "custom");
};

export const openai = (model: OpenAIChatModel, options?: Omit<ModelOptions, "baseUrl">) => {
  return createLLMClient(model, { ...options, baseUrl: "https://api.openai.com/v1" }, "openai");
};

// eslint-disable-next-line @typescript-eslint/ban-types
type OllamaModels = (typeof OLLAMA_MODELS)[number] | (string & {});

type OllamaModelResult = {
  models: {
    name: string;
  }[];
};

export const ollama = (model: OllamaModels, options?: Omit<ModelOptions, "baseUrl">) => {
  const baseUrl = "http://localhost:11434";

  void fetch(`${baseUrl}/api/tags`).then((tags) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    tags.json().then((data: unknown) => {
      const mappedModels = (data as OllamaModelResult).models.filter((m) => m.name.includes(model));
      if (mappedModels.length === 0) throw new Error("Please, pull the model before you run.");
    });
  });

  return createLLMClient(model, { ...options, baseUrl: `${baseUrl}/v1` }, "ollama");
};
