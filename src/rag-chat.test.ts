/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ChatOpenAI } from "@langchain/openai";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { Index } from "@upstash/vector";
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
    await ragChat.context.add({
      dataType: "text",
      data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
    });
    await awaitUntilIndexed(vector);
  });

  afterAll(async () => await vector.reset());

  test.skip("should get result without streaming", async () => {
    const result = await ragChat.chat(
      "What year was the construction of the Eiffel Tower completed, and what is its height?",
      { streaming: false }
    );

    expect(result.output).toContain("330");
  });

  test.skip("should get result with streaming", async () => {
    const result = await ragChat.chat("Which famous artworks can be found in the Louvre Museum?", {
      streaming: true,
    });

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

  test.skip(
    "should throw ratelimit error",
    async () => {
      await ragChat.context.add(
        {
          dataType: "text",
          data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
        },
        { metadataKey: "text" }
      );
      await awaitUntilIndexed(vector);

      await ragChat.chat(
        "What year was the construction of the Eiffel Tower completed, and what is its height?",
        { streaming: false, metadataKey: "text" }
      );

      const throwable = async () => {
        await ragChat.chat("You shall not pass", { streaming: false });
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
    prompt: () => "Just say `I'm a cookie monster`. Nothing else.",
    model: new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: false,
      verbose: false,
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    }),
  });

  test.skip(
    "should get result without streaming",
    async () => {
      await ragChat.context.add(
        { dataType: "text", data: "Ankara is the capital of Turkiye." },
        { metadataKey: "text" }
      );

      // Wait for it to be indexed
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      await awaitUntilIndexed(vector);

      const result = await ragChat.chat("Where is the capital of Turkiye?", {
        streaming: false,
      });

      expect(result.output).toContain("I'm a cookie monster");
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

  test.skip(
    "should be able to successfully query embedded book",
    async () => {
      await ragChat.context.add({
        dataType: "pdf",
        fileSource: "./data/the_wonderful_wizard_of_oz.pdf",
        opts: { chunkSize: 500, chunkOverlap: 50 },
      });
      await awaitUntilIndexed(vector);
      const result = await ragChat.chat("Whats the author of The Wonderful Wizard of Oz?", {
        streaming: false,
      });
      expect(result.output).toContain("Frank");
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

  test.skip(
    "should reply back using in-memory db",
    async () => {
      await ragChat.context.add({ data: "Ankara is the capital of Turkiye.", dataType: "text" });
      await awaitUntilIndexed(vector);

      await ragChat.chat("Hello, my name is Oz!", {
        streaming: false,
        sessionId: "find-name",
        historyLength: 5,
      });
      await ragChat.chat("How are you?", {
        streaming: false,
        sessionId: "find-name",
        historyLength: 5,
      });
      const result = await ragChat.chat("Do you remember my name?", {
        streaming: false,
        sessionId: "find-name",
        historyLength: 5,
      });
      expect(result.output).toInclude("Oz");
    },
    { timeout: 10_000 }
  );
});

describe("RAG Chat addContext using CSV", () => {
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });

  const ragChat = new RAGChat({
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

  test.skip(
    "should be able to successfully query csv",
    async () => {
      await ragChat.context.add({
        dataType: "csv",
        fileSource: "./data/list_of_user_info.csv",
      });
      await awaitUntilIndexed(vector);
      const result = await ragChat.chat("Whats username of Rachel Booker?", {
        streaming: false,
      });
      expect(result.output).toContain("booker12");
    },
    { timeout: 30_000 }
  );
});

describe("RAG Chat addContext using text-file", () => {
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });

  const ragChat = new RAGChat({
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

  test.skip(
    "should be able to successfully query txt file",
    async () => {
      await ragChat.context.add({
        dataType: "text-file",
        fileSource: "./data/the_wonderful_wizard_of_oz_summary.txt",
        opts: { chunkSize: 500, chunkOverlap: 50 },
      });
      await awaitUntilIndexed(vector);

      const result = await ragChat.chat("Whats the author of The Wonderful Wizard of Oz?", {
        streaming: false,
        metadataKey: "text",
      });

      expect(result.output).toContain("Frank");
    },
    { timeout: 30_000 }
  );
});

describe("RAG Chat addContext using HTML", () => {
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });

  const ragChat = new RAGChat({
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

  test.skip(
    "should be able to successfully query html file",
    async () => {
      await ragChat.context.add({
        dataType: "html",
        fileSource: "./data/the_wonderful_wizard_of_oz_summary.html",
      });
      await awaitUntilIndexed(vector);

      const result = await ragChat.chat("Whats the author of The Wonderful Wizard of Oz?", {
        streaming: false,
        metadataKey: "text",
      });

      expect(result.output).toContain("Frank");
    },
    { timeout: 30_000 }
  );
});

describe("RAGChat with namespaces", () => {
  const namespace = "japan";
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });

  const ragChat = new RAGChat({
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
    await vector.reset({ namespace });
  });

  test.skip(
    "should be able to insert data into a namespace and query it",
    async () => {
      await ragChat.context.add("Tokyo is the Capital of Japan.", {
        namespace,
        metadataKey: "text",
      });
      await awaitUntilIndexed(vector);

      const result = await ragChat.chat("Where is the capital of Japan?", {
        streaming: false,
        metadataKey: "text",
        namespace,
      });

      expect(result.output).toContain("Tokyo");
    },
    { timeout: 30_000 }
  );
});

// describe("RAGChat init without model", () => {
//   const namespace = "japan";
//   const vector = new Index({
//     token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
//     url: process.env.UPSTASH_VECTOR_REST_URL!,
//   });

//   const ragChat = new RAGChat({
//     vector,
//   });

//   afterAll(async () => {
//     await vector.reset({ namespace });
//   });

//   test.skip(
//     "should be able to insert data into a namespace and query it",
//     async () => {
//       await ragChat.context.add("Tokyo is the Capital of Japan.", {
//         namespace,
//         metadataKey: "text",
//       });
//       await awaitUntilIndexed(vector);

//       const result = await ragChat.chat("Where is the capital of Japan?", {
//         streaming: false,
//         metadataKey: "text",
//         namespace,
//       });
//       expect(result.output).toContain("Tokyo");
//     },
//     { timeout: 30_000 }
//   );
// });
