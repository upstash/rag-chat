/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { AIMessage } from "@langchain/core/messages";
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { Index } from "@upstash/vector";
import type { StreamingTextResponse } from "ai";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { RatelimitUpstashError } from "./error/ratelimit";
import { RAGChat } from "./rag-chat";
import { awaitUntilIndexed } from "./test-utils";

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
    await ragChat.addContext({
      dataType: "text",
      data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
    });
    await awaitUntilIndexed(vector);
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
        {
          dataType: "text",
          data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
        },
        { metadataKey: "text" }
      );
      await awaitUntilIndexed(vector);

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
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });
  const ragChat = new RAGChat({
    vector,
    redis: new Redis({
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      url: process.env.UPSTASH_REDIS_REST_URL!,
    }),
    prompt: PromptTemplate.fromTemplate("Just say `I'm a cookie monster`. Nothing else."),
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
      await ragChat.addContext(
        { dataType: "text", data: "Ankara is the capital of Turkiye." },
        { metadataKey: "text" }
      );

      // Wait for it to be indexed
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      await awaitUntilIndexed(vector);

      const result = (await ragChat.chat("Where is the capital of Turkiye?", {
        stream: false,
      })) as AIMessage;

      expect(result.content).toContain("I'm a cookie monster");
    },
    { timeout: 30_000 }
  );
});

describe("RAG Chat addContext using PDF", () => {
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });
  const redis = new Redis({
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    url: process.env.UPSTASH_REDIS_REST_URL!,
  });
  const ragChat = new RAGChat({
    redis,
    vector,
    model: new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: false,
      verbose: false,
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    }),
  });

  afterAll(async () => {
    await vector.reset();
  });

  test(
    "should be able to successfully query embedded book",
    async () => {
      await ragChat.addContext({
        dataType: "pdf",
        fileSource: "./data/the_wonderful_wizard_of_oz.pdf",
        opts: { chunkSize: 500, chunkOverlap: 50 },
      });
      await awaitUntilIndexed(vector);
      const result = (await ragChat.chat("Whats the author of The Wonderful Wizard of Oz?", {
        stream: false,
      })) as AIMessage;
      expect(result.content).toContain("Frank");
    },
    { timeout: 30_000 }
  );
});

describe("RAG Chat without Redis, but In-memory chat history", () => {
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
  });

  afterAll(async () => {
    await vector.reset();
  });

  test(
    "should reply back using in-memory db",
    async () => {
      await ragChat.addContext({ data: "Ankara is the capital of Turkiye.", dataType: "text" });
      await awaitUntilIndexed(vector);

      await ragChat.chat("Hello, my name is Oz!", {
        stream: false,
        sessionId: "find-name",
        historyLength: 5,
      });
      await ragChat.chat("How are you?", {
        stream: false,
        sessionId: "find-name",
        historyLength: 5,
      });
      const result = await ragChat.chat("Do you remember my name?", {
        stream: false,
        sessionId: "find-name",
        historyLength: 5,
      });
      expect((result as AIMessage).content).toInclude("Oz");
    },
    { timeout: 10_000 }
  );
});
