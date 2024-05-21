/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import type { StreamingTextResponse } from "ai";
import { sleep } from "bun";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { RAGChat } from "./rag-chat";
import { Index } from "@upstash/vector";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { RatelimitUpstashError } from "./error/ratelimit";
import { PromptTemplate } from "@langchain/core/prompts";
import { delay } from "./utils";

describe("RAG Chat with advance configs and direct instances", () => {
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });

  const ragChat = new RAGChat({
    model: new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: true,
      verbose: false,
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    }),
    vector,
    redis: new Redis({
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      url: process.env.UPSTASH_REDIS_REST_URL!,
    }),
  });

  beforeAll(async () => {
    await ragChat.addContext(
      "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
      "text"
    );
    //eslint-disable-next-line @typescript-eslint/no-magic-numbers
    await sleep(3000);
  });

  afterAll(async () => await vector.reset());

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

describe("RAG Chat with ratelimit", () => {
  const redis = new Redis({
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    url: process.env.UPSTASH_REDIS_REST_URL!,
  });
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });

  const ragChat = new RAGChat({
    model: new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: false,
      verbose: false,
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    }),
    vector,
    redis,
    ratelimit: new Ratelimit({
      redis,
      limiter: Ratelimit.tokenBucket(1, "1d", 1),
      prefix: "@upstash/rag-chat-ratelimit",
    }),
  });

  afterAll(async () => {
    await redis.flushdb();
    await vector.reset();
  });

  test(
    "should throw ratelimit error",
    async () => {
      await ragChat.addContext(
        "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
        "text"
      );
      //eslint-disable-next-line @typescript-eslint/no-magic-numbers
      await sleep(3000);

      await ragChat.chat(
        "What year was the construction of the Eiffel Tower completed, and what is its height?",
        { stream: false, metadataKey: "text" }
      );

      const throwable = async () => {
        await ragChat.chat("You shall not pass", { stream: false });
      };

      expect(throwable).toThrowError(RatelimitUpstashError);
    },
    { timeout: 10_000 }
  );
});

describe("RAG Chat with custom template", () => {
  const ragChat = new RAGChat({
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
