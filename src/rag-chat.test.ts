/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ChatOpenAI } from "@langchain/openai";
import { RAGChat } from "./rag-chat";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AIMessage } from "@langchain/core/messages";
import { delay } from "./utils";
import { Index, Ratelimit, Redis, Upstash } from "@upstash/sdk";
import type { StreamingTextResponse } from "ai";
import { DEFAULT_REDIS_DB_NAME, DEFAULT_VECTOR_DB_NAME } from "./constants";
import { RatelimitUpstashError } from "./error";
import { PromptTemplate } from "@langchain/core/prompts";

describe("RAG Chat with advance configs and direct instances", async () => {
  const ragChat = await RAGChat.initialize({
    email: process.env.UPSTASH_EMAIL!,
    token: process.env.UPSTASH_TOKEN!,
    model: new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: true,
      verbose: false,
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    }),
    vector: new Index({
      token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
      url: process.env.UPSTASH_VECTOR_REST_URL!,
    }),
    redis: new Redis({
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      url: process.env.UPSTASH_REDIS_REST_URL!,
    }),
  });

  beforeAll(async () => {
    await ragChat.addContext(
      "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall."
    );
  });

  test("should get result without streaming", async () => {
    const result = (await ragChat.chat(
      "What year was the construction of the Eiffel Tower completed, and what is its height?",
      { stream: false }
    )) as AIMessage;
    expect(result.content).toContain("330");
  });

  test("should get result with streaming", async () => {
    const result = (await ragChat.chat("Which famous artworks can be found in the Louvre Museum?", {
      stream: true,
    })) as StreamingTextResponse;
    expect(result).toBeTruthy();
  });
});

describe("RAG Chat with basic configs", async () => {
  const ragChat = await RAGChat.initialize({
    email: process.env.UPSTASH_EMAIL!,
    token: process.env.UPSTASH_TOKEN!,
    model: new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: false,
      verbose: false,
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    }),
    region: "eu-west-1",
  });

  const upstashSDK = new Upstash({
    email: process.env.UPSTASH_EMAIL!,
    token: process.env.UPSTASH_TOKEN!,
  });

  afterAll(async () => {
    await upstashSDK.deleteRedisDatabase(DEFAULT_REDIS_DB_NAME);
    await upstashSDK.deleteVectorIndex(DEFAULT_VECTOR_DB_NAME);
  });

  test(
    "should get result without streaming",
    async () => {
      await ragChat.addContext(
        "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall."
      );

      // Wait for it to be indexed
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      await delay(3000);

      const result = (await ragChat.chat(
        "What year was the construction of the Eiffel Tower completed, and what is its height?",
        { stream: false }
      )) as AIMessage;

      expect(result.content).toContain("330");
    },
    { timeout: 30_000 }
  );
});

describe("RAG Chat with ratelimit", async () => {
  const redis = new Redis({
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    url: process.env.UPSTASH_REDIS_REST_URL!,
  });
  const ragChat = await RAGChat.initialize({
    email: process.env.UPSTASH_EMAIL!,
    token: process.env.UPSTASH_TOKEN!,
    model: new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: false,
      verbose: false,
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    }),
    vector: new Index({
      token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
      url: process.env.UPSTASH_VECTOR_REST_URL!,
    }),
    redis,
    ratelimit: new Ratelimit({
      redis,
      limiter: Ratelimit.tokenBucket(1, "1d", 1),
      prefix: "@upstash/rag-chat-ratelimit",
    }),
  });

  afterAll(async () => {
    await redis.flushdb();
  });

  test("should throw ratelimit error", async () => {
    await ragChat.chat(
      "What year was the construction of the Eiffel Tower completed, and what is its height?",
      { stream: false }
    );

    const throwable = async () => {
      await ragChat.chat("You shall not pass", { stream: false });
    };

    expect(throwable).toThrowError(RatelimitUpstashError);
  });
});

describe("RAG Chat with instance names", async () => {
  const ragChat = await RAGChat.initialize({
    email: process.env.UPSTASH_EMAIL!,
    token: process.env.UPSTASH_TOKEN!,
    redis: "my-fancy-redis-db",
    vector: "my-fancy-vector-db",
    model: new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: false,
      verbose: false,
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    }),
    region: "eu-west-1",
  });

  afterAll(async () => {
    const upstashSDK = new Upstash({
      email: process.env.UPSTASH_EMAIL!,
      token: process.env.UPSTASH_TOKEN!,
    });
    await upstashSDK.deleteRedisDatabase("my-fancy-redis-db");
    await upstashSDK.deleteVectorIndex("my-fancy-vector-db");
  });

  test(
    "should get result without streaming",
    async () => {
      await ragChat.addContext(
        "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall."
      );

      // Wait for it to be indexed
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      await delay(3000);

      const result = (await ragChat.chat(
        "What year was the construction of the Eiffel Tower completed, and what is its height?",
        { stream: false }
      )) as AIMessage;

      expect(result.content).toContain("330");
    },
    { timeout: 30_000 }
  );
});

describe("RAG Chat with custom template", async () => {
  const ragChat = await RAGChat.initialize({
    email: process.env.UPSTASH_EMAIL!,
    token: process.env.UPSTASH_TOKEN!,
    vector: new Index({
      token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
      url: process.env.UPSTASH_VECTOR_REST_URL!,
    }),
    redis: new Redis({
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      url: process.env.UPSTASH_REDIS_REST_URL!,
    }),
    template: PromptTemplate.fromTemplate("Just say `I'm a cookie monster`. Nothing else."),
    model: new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: false,
      verbose: false,
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    }),
  });

  test(
    "should get result without streaming",
    async () => {
      await ragChat.addContext("Ankara is the capital of Turkiye.");

      // Wait for it to be indexed
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      await delay(3000);

      const result = (await ragChat.chat("Where is the capital of Turkiye?", {
        stream: false,
      })) as AIMessage;

      expect(result.content).toContain("I'm a cookie monster");
    },
    { timeout: 30_000 }
  );
});
