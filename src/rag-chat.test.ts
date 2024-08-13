/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ChatOpenAI } from "@langchain/openai";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { Index } from "@upstash/vector";
import { LangChainAdapter, StreamingTextResponse } from "ai";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { RatelimitUpstashError } from "./error";
import { custom, upstash } from "./models";
import { RAGChat } from "./rag-chat";
import { awaitUntilIndexed } from "./test-utils";

async function checkStream(
  stream: ReadableStream<string>,
  expectInStream: string[] // array of strings to expect in stream
): Promise<void> {
  const _stream = LangChainAdapter.toAIStream(stream);
  const textResponse = new StreamingTextResponse(_stream);
  const text = await textResponse.text();

  const lines = text.split("\n").filter((line) => line.length > 0);

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.some((line) => line.startsWith('0:"'))).toBeTrue(); // all lines start with `0:"`
  expect(expectInStream.every((token) => text.includes(token))).toBeTrue();
}

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
      type: "text",
      data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
    });
    await awaitUntilIndexed(vector);
  });

  afterAll(async () => await vector.reset());

  test("should get result without streaming", async () => {
    const result = await ragChat.chat(
      "What year was the construction of the Eiffel Tower completed, and what is its height?",
      { streaming: false }
    );
    expect(result.output).toContain("330");
  });

  test("should get result with streaming", async () => {
    const streamResult = await ragChat.chat(
      "What year was the construction of the Eiffel Tower completed, and what is its height?",
      {
        streaming: true,
      }
    );
    await checkStream(streamResult.output, ["330"]);
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
      let remainingLimit = -9;

      await ragChat.context.add({
        type: "text",
        data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
      });
      await awaitUntilIndexed(vector);
      await ragChat.chat(
        "What year was the construction of the Eiffel Tower completed, and what is its height?",
        { streaming: false, metadataKey: "text" }
      );

      const throwable = async () => {
        await ragChat.chat("You shall not pass", {
          streaming: false,
          ratelimitDetails: (response) => {
            remainingLimit = response.remaining;
          },
        });
      };

      expect(throwable).toThrowError(RatelimitUpstashError);
      expect(remainingLimit).toEqual(-1);
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
    promptFn: () => "Just say `I'm a cookie monster`. Nothing else.",
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
      await ragChat.context.add({
        type: "text",
        data: "Ankara is the capital of Turkiye.",
      });

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

  test(
    "should be able to successfully query embedded book",
    async () => {
      await ragChat.context.add({
        type: "pdf",
        fileSource: "./data/the_wonderful_wizard_of_oz.pdf",
        config: { chunkSize: 500, chunkOverlap: 50 },
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

  test(
    "should reply back using in-memory db",
    async () => {
      await ragChat.context.add({ data: "Ankara is the capital of Turkiye.", type: "text" });
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

  test(
    "should be able to successfully query csv",
    async () => {
      await ragChat.context.add({
        type: "csv",
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

  test(
    "should be able to successfully query txt file",
    async () => {
      await ragChat.context.add({
        type: "text-file",
        fileSource: "./data/the_wonderful_wizard_of_oz_summary.txt",
        config: { chunkSize: 500, chunkOverlap: 50 },
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

  test(
    "should be able to successfully query html file",
    async () => {
      await ragChat.context.add({
        type: "html",
        source: "./data/the_wonderful_wizard_of_oz_summary.html",
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
    namespace,
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

  test(
    "should be able to add context with plain text",
    async () => {
      await ragChat.context.add("Adana is the capital of Japan.");
      await awaitUntilIndexed(vector);

      const result = await ragChat.chat("What is the capital of Japan?", {
        streaming: false,
        metadataKey: "text",
      });

      expect(result.output).toContain("Adana");
    },
    { timeout: 30_000 }
  );
});

describe("RAGChat init with custom model", () => {
  const namespace = "japan";
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });

  const ragChat = new RAGChat({
    vector,
    model: upstash("meta-llama/Meta-Llama-3-8B-Instruct"),
  });

  afterAll(async () => {
    await vector.reset({ namespace });
  });

  test(
    "should be able to insert data into a namespace and query it with custom model",
    async () => {
      await ragChat.context.add({
        type: "text",
        data: "Tokyo is the Capital of Japan.",
        options: { namespace },
      });
      await awaitUntilIndexed(vector);

      const result = await ragChat.chat("Where is the capital of Japan?", {
        metadataKey: "text",
        namespace,
      });

      expect(result.output).toContain("Tokyo");
    },
    { timeout: 30_000 }
  );
});

describe("RAGChat pass options from constructor", () => {
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });

  const tests = {
    metadata: {
      constructorInit: { hello: "world" },
      chatOptions: { world: "hello" },
    },
    namespace: {
      constructorInit: "Germany",
      chatOptions: "Turkiye",
    },
    sessionId: {
      constructorInit: "something",
      chatOptions: "something-else",
    },
    streaming: {
      constructorInit: true,
      chatOptions: false,
    },
    ratelimitSessionId: {
      constructorInit: "ratelimitSessionId",
      chatOptions: "ratelimitSessionId-1",
    },
  };

  const ragChat = new RAGChat({
    vector,
    model: upstash("meta-llama/Meta-Llama-3-8B-Instruct", {
      apiKey: process.env.QSTASH_TOKEN!,
    }),
    ...Object.fromEntries(
      Object.entries(tests).map(([key, value]) => [key, value.constructorInit])
    ),
  });

  afterAll(async () => {
    await vector.reset({ namespace: tests.namespace.chatOptions });
  });

  test("should be able to get configs from constructor then override with chat options", async () => {
    await ragChat.context.add({
      type: "text",
      data: "Tokyo is the Capital of Japan.",
      options: { namespace: tests.namespace.chatOptions },
    });

    await awaitUntilIndexed(vector);

    // Check constructor initialization values
    for (const [key, value] of Object.entries(tests)) {
      //@ts-expect-error expected error required for testing
      expect(ragChat.config[key]).toBe(value.constructorInit);
    }

    await ragChat.chat("Where is the capital of Japan?", {
      ...Object.fromEntries(Object.entries(tests).map(([key, value]) => [key, value.chatOptions])),
      onContextFetched() {
        // Check chat options values
        for (const [key, value] of Object.entries(tests)) {
          //@ts-expect-error typescript can't find the types because of Object.fromEntries above.
          expect(this[key]).toBe(value.chatOptions);
        }
        // eslint-disable-next-line unicorn/no-null
        return null;
      },
    });
  });
});

describe("RAGChat - chat usage with onHistoryFetched hook", () => {
  const namespace = "japan";
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });

  const ragChat = new RAGChat({
    vector,
    streaming: true,
    model: upstash("meta-llama/Meta-Llama-3-8B-Instruct"),
  });

  afterAll(async () => {
    await vector.reset({ namespace });
  });

  test(
    "should be able to insert data into a namespace and query it with onHistoryFetched",
    async () => {
      await ragChat.context.add({
        type: "text",
        data: "Tokyo is the Capital of Japan.",
        options: { namespace },
      });
      await awaitUntilIndexed(vector);

      let firstHistoryContent = "";
      await ragChat.chat("Where is the capital of Japan?", {
        namespace,
        onChatHistoryFetched(messages) {
          firstHistoryContent = messages[0].content;
          return messages;
        },
      });
      expect(firstHistoryContent).toBe("Where is the capital of Japan?");
    },
    { timeout: 30_000 }
  );
});

describe("RAGChat - chat usage with disabled RAG ", () => {
  const namespace = "japan";
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });
  const redis = Redis.fromEnv();

  const ragChat = new RAGChat({
    vector,
    streaming: false,
    redis,
    model: custom("meta-llama/Meta-Llama-3-8B-Instruct", {
      apiKey: process.env.QSTASH_TOKEN!,
      baseUrl: "https://qstash.upstash.io/llm/v1",
    }),
  });

  afterEach(async () => {
    await vector.reset({ namespace });
    await redis.flushdb();
  });

  test(
    "should be able to chat without rag not ask question",
    async () => {
      await ragChat.context.add({
        type: "text",
        data: "Tokyo is the Capital of Japan.",
        options: { namespace },
      });
      await awaitUntilIndexed(vector);

      const result = await ragChat.chat("Ankara is the capital of Turkey", {
        namespace,
        disableRAG: true,
        promptFn: ({ question }) => {
          return `Is the following a question? Answer "YES" if it is a question and "NO" if it is not.
              Input: ${question}
              Answer:`;
        },
      });

      let actualResult = "";
      if (result.output.includes("YES")) {
        const actualQuestion = await ragChat.chat("Where is the capital of Japan?", {
          namespace,
        });
        actualResult = actualQuestion.output;
        expect(actualQuestion.output).toContain("Tokyo");
      } else {
        expect(actualResult).not.toContain("Tokyo");
      }
    },
    { timeout: 30_000 }
  );

  test(
    "should be able to chat without rag and ask question",
    async () => {
      await ragChat.context.add({
        type: "text",
        data: "Tokyo is the Capital of Japan.",
        options: { namespace },
      });
      await awaitUntilIndexed(vector);

      const result = await ragChat.chat("Where is the capital of Japan?", {
        namespace,
        disableRAG: true,
        promptFn: ({ question }) => {
          return `Is the following a question? Answer "YES" if it is a question and "NO" if it is not. Maku sure its either capitalized "YES" or "NO"
            Input: ${question}
            Answer:`;
        },
      });

      let actualResult = "";
      if (result.output.includes("YES")) {
        const actualQuestion = await ragChat.chat("Where is the capital of Japan?", {
          namespace,
          promptFn: ({ question, context }) => {
            return `Answer the question using following context. Give answer in all lowercase"
              Context: ${context}
              Input: ${question}
              Answer:`;
          },
        });
        actualResult = actualQuestion.output;
        expect(actualQuestion.output.toLowerCase()).toContain("tokyo");
      } else {
        expect(actualResult.toLowerCase()).not.toContain("tokyo");
      }
    },
    { timeout: 30_000 }
  );

  test(
    "should be able to chat without rag and ask question with default disabled rag chat prompt -ozoz",
    async () => {
      await ragChat.chat("Tokyo is the capital of Japan.", { disableRAG: true });
      await awaitUntilIndexed(vector);

      const result = await ragChat.chat("Where is the capital of Japan?", {
        namespace,
        disableRAG: true,
      });

      expect(result.output.toLowerCase()).toContain("tokyo");
    },
    { timeout: 30_000 }
  );
});

describe("RAGChat - result metadata", () => {
  const namespace = "japan-v2";
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });

  const ragChat = new RAGChat({
    vector,
    streaming: true,
    model: upstash("meta-llama/Meta-Llama-3-8B-Instruct"),
  });

  afterAll(async () => {
    await vector.reset({ namespace });
    await vector.deleteNamespace(namespace);
  });

  test(
    "should return metadata",
    async () => {
      await ragChat.context.add({
        type: "text",
        data: "Tokyo is the Capital of Japan.",
        options: { namespace, metadata: { unit: "Samurai" } },
      });
      await ragChat.context.add({
        type: "text",
        data: "Shakuhachi is a traditional wind instrument",
        options: { namespace, metadata: { unit: "Shakuhachi" } },
      });
      await awaitUntilIndexed(vector);

      const result = await ragChat.chat<{ unit: string }>("Where is the capital of Japan?", {
        namespace,
      });

      expect(result.metadata).toEqual([
        {
          unit: "Samurai",
        },
        {
          unit: "Shakuhachi",
        },
      ]);
    },
    { timeout: 30_000 }
  );
});
