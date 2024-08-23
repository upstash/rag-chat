import { afterAll, describe, expect, test } from "bun:test";
import { Client } from "langsmith";
import { custom, openai, upstash } from "./models";
import { RAGChat } from "./rag-chat";

const originalEnvironment = { ...process.env };

describe("Model", () => {
  test("should raise error when api key is not found", () => {
    let ran = false;
    const throws = () => {
      try {
        new RAGChat({
          model: upstash("meta-llama/Meta-Llama-3-8B-Instruct", { apiKey: "" }),
        });
      } catch (error) {
        ran = true;
        throw error;
      }
    };
    expect(throws).toThrow(
      "Failed to create upstash LLM client: QSTASH_TOKEN not found." +
        " Pass apiKey parameter or set QSTASH_TOKEN env variable."
    );
    expect(ran).toBeTrue();
  });
});

describe("Model inits", () => {
  // Mock environment variables
  process.env.OPENAI_API_KEY = "mock-openai-api-key";
  process.env.QSTASH_TOKEN = "mock-qstash-token";

  afterAll(() => {
    process.env = originalEnvironment;
  });

  test("OpenAI client configuration with Helicone", () => {
    const client = openai("gpt-3.5-turbo", {
      analytics: { name: "helicone", token: "mock-helicone-token" },
    });

    //@ts-expect-error required for testing
    expect(client.clientConfig.baseURL).toBe("https://oai.helicone.ai/v1");
    //@ts-expect-error required for testing
    expect(client.clientConfig.defaultHeaders).toEqual({
      "Helicone-Auth": "Bearer mock-helicone-token",
      Authorization: "Bearer mock-openai-api-key",
    });
  });

  test("OpenAI client configuration with Cloudflare AI Gateway", () => {
    const client = openai("gpt-3.5-turbo", {
      analytics: {
        name: "cloudflare",
        accountId: "mock-account-id",
        gatewayName: "mock-gateway-name",
      },
    });

    //@ts-expect-error required for testing
    expect(client.clientConfig.baseURL).toBe(
      "https://gateway.ai.cloudflare.com/v1/mock-account-id/mock-gateway-name/openai"
    );
    //@ts-expect-error required for testing
    expect(client.clientConfig.defaultHeaders).toEqual({
      Authorization: "Bearer mock-cloudflare-token",
      "Content-Type": "application/json",
    });
  });

  test("OpenAI client configuration without analytics", () => {
    const config = {
      apiKey: "no-key",
      presencePenalty: 1,
      maxTokens: 4000,
      temperature: 0.5,
      frequencyPenalty: 0.6,
      topP: 1,
      logprobs: true,
      streamUsage: false,
      topLogprobs: 11,
      n: 12,
      logitBias: {},
      stop: [],
    };

    const client = openai("gpt-3.5-turbo", config);

    // @ts-expect-error we have to access this for testing
    expect(client.clientConfig.baseURL).toBe("https://api.openai.com/v1");
    // @ts-expect-error we have to access this for testing
    expect(client.clientConfig.apiKey).toBe(config.apiKey);

    // Test all config properties
    for (const [key, value] of Object.entries(config)) {
      if (key !== "apiKey" && key !== "streamUsage") {
        // @ts-expect-error Dynamic access for testing
        expect(client[key]).toEqual(value);
      }
    }
  });

  test("Upstash client configuration", () => {
    const client = upstash("mistralai/Mistral-7B-Instruct-v0.2", {
      analytics: { name: "helicone", token: "mock-helicone-token" },
    });
    //@ts-expect-error required for testing
    expect(client.clientConfig.baseURL).toBe("https://qstash.helicone.ai/llm/v1");
    //@ts-expect-error required for testing
    expect(client.clientConfig.defaultHeaders).toEqual({
      "Helicone-Auth": "Bearer mock-helicone-token",
      Authorization: "Bearer mock-qstash-token",
    });
  });

  test("Custom client configuration", () => {
    const client = custom("custom-model", {
      baseUrl: "https://custom-llm-api.com",
      apiKey: "mock-custom-api-key",
      analytics: { name: "helicone", token: "mock-helicone-token" },
    });

    //@ts-expect-error required for testing
    expect(client.clientConfig.baseURL).toBe("https://gateway.helicone.ai");
    //@ts-expect-error required for testing
    expect(client.clientConfig.defaultHeaders).toEqual({
      "Helicone-Auth": "Bearer mock-helicone-token",
      "Helicone-Target-Url": "https://custom-llm-api.com",
      Authorization: "Bearer mock-custom-api-key",
    });
  });

  test("Langsmith analytics configuration", () => {
    openai("gpt-3.5-turbo", {
      analytics: { name: "langsmith", token: "mock-langsmith-token" },
    });
    expect(global.globalTracer).toBeDefined();
    expect(global.globalTracer).toBeInstanceOf(Client);
    global.globalTracer = undefined;
  });
  test("Langsmith analytics configuration should fail when token is undefined", () => {
    openai("gpt-3.5-turbo", {
      //@ts-expect-error required for testing
      analytics: { name: "langsmith", token: undefined },
    });
    expect(global.globalTracer).not.toBeInstanceOf(Client);
  });
});
