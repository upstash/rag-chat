/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ChatOpenAI } from "@langchain/openai";
import { openai } from "@ai-sdk/openai";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { Index } from "@upstash/vector";
import { LangChainAdapter, StreamingTextResponse } from "ai";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  spyOn,
} from "bun:test";
import type { Mock } from "bun:test";
import { RatelimitUpstashError } from "./error";
import { custom, upstash, openai as upstashOpenai } from "./models";
import { RAGChat } from "./rag-chat";
import { awaitUntilIndexed } from "./test-utils";
import type { PrepareChatResult } from "./types";

async function checkStream(
  stream: ReadableStream<string>,
  expectInStream: string[] // array of strings to expect in stream
): Promise<void> {
  const _stream = LangChainAdapter.toDataStream(stream);
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const textResponse = new StreamingTextResponse(_stream);
  const text = await textResponse.text();

  const lines = text.split("\n").filter((line) => line.length > 0);

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.some((line) => line.startsWith('0:"'))).toBeTrue(); // all lines start with `0:"`
  expect(expectInStream.every((token) => text.includes(token))).toBeTrue();
}

describe("RAG Chat with advance configs and direct instances", () => {
  const namespace = "advanced";
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });
  const redis = new Redis({
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    url: process.env.UPSTASH_REDIS_REST_URL!,
  });

  const ragChat = new RAGChat({
    model: upstashOpenai("gpt-3.5-turbo"),
    vector,
    namespace,
    redis,
  });

  beforeAll(async () => {
    await ragChat.context.add({
      type: "text",
      data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
      options: { namespace },
    });
    await awaitUntilIndexed(vector);
  });

  afterAll(async () => {
    await vector.reset({ namespace });
    await vector.deleteNamespace(namespace);
    await redis.flushdb();
  });

  test("should get result without streaming", async () => {
    const result = await ragChat.chat(
      "What year was the construction of the Eiffel Tower completed, and what is its height?",
      { streaming: false }
    );
    expect(result.output).toContain("330");
    expect(result.history).toEqual([
      {
        content:
          "What year was the construction of the Eiffel Tower completed, and what is its height?",
        role: "user",
        id: "0",
      },
    ]);
    expect(result.context[0].data).toContain(
      "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall."
    );
  });
});

describe("RAG Chat with ratelimit", () => {
  const namespace = "ratelimit";
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
      configuration: {
        // if the OPENAI_ORGANIZATION env var is not set, the test may pass.
        // we don't want it to pass so we pass a wrong key to make the test
        // fail
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        organization: process.env.OPENAI_ORGANIZATION || "wrong-key",
      },
    }),
    vector,
    redis,
    namespace,
    ratelimit: new Ratelimit({
      redis,
      limiter: Ratelimit.tokenBucket(1, "1d", 1),
      prefix: "@upstash/rag-chat-ratelimit",
    }),
  });

  afterAll(async () => {
    await redis.flushdb();
    await vector.reset({ namespace });
    await vector.deleteNamespace(namespace);
  });

  test(
    "should throw ratelimit error",
    async () => {
      let remainingLimit = -9;

      await ragChat.context.add({
        type: "text",
        data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
        options: { namespace },
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
  const namespace = "custom-template";
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });
  const ragChat = new RAGChat({
    vector,
    namespace,
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
      configuration: {
        organization: process.env.OPENAI_ORGANIZATION,
      },
    }),
  });

  afterAll(async () => {
    await vector.reset({ namespace });
    await vector.deleteNamespace(namespace);
  });

  test(
    "should get result without streaming",
    async () => {
      await ragChat.context.add({
        type: "text",
        data: "Ankara is the capital of Turkiye.",
        options: { namespace },
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
  const namespace = "pdf";
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
    namespace,
    model: new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: false,
      verbose: false,
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
      configuration: {
        organization: process.env.OPENAI_ORGANIZATION,
      },
    }),
  });

  afterAll(async () => {
    await redis.flushdb();
    await vector.reset({ namespace });
    await vector.deleteNamespace(namespace);
  });

  test(
    "should be able to successfully query embedded book",
    async () => {
      await ragChat.context.add({
        type: "pdf",
        fileSource: "./data/the_wonderful_wizard_of_oz.pdf",
        config: { chunkSize: 500, chunkOverlap: 50 },
        options: { namespace },
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
  const namespace = "in-memory";
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
      configuration: {
        organization: process.env.OPENAI_ORGANIZATION,
      },
    }),
    vector,
    namespace,
  });

  afterAll(async () => {
    await vector.reset({ namespace });
    await vector.deleteNamespace(namespace);
  });

  test(
    "should reply back using in-memory db",
    async () => {
      await ragChat.context.add({
        data: "Ankara is the capital of Turkiye.",
        type: "text",
        options: { namespace },
      });
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
  const namespace = "csv";
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
      configuration: {
        organization: process.env.OPENAI_ORGANIZATION,
      },
    }),
  });

  afterAll(async () => {
    await vector.reset({ namespace });
    await vector.deleteNamespace(namespace);
  });

  test(
    "should be able to successfully query csv",
    async () => {
      await ragChat.context.add({
        type: "csv",
        fileSource: "./data/list_of_user_info.csv",
        options: { namespace },
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
  const namespace = "text-file";
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
      configuration: {
        organization: process.env.OPENAI_ORGANIZATION,
      },
    }),
  });

  afterAll(async () => {
    await vector.reset({ namespace });
    await vector.deleteNamespace(namespace);
  });

  test(
    "should be able to successfully query txt file",
    async () => {
      await ragChat.context.add({
        type: "text-file",
        fileSource: "./data/the_wonderful_wizard_of_oz_summary.txt",
        config: { chunkSize: 500, chunkOverlap: 50 },
        options: { namespace },
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
  const namespace = "html";
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
      configuration: {
        organization: process.env.OPENAI_ORGANIZATION,
      },
    }),
  });

  afterAll(async () => {
    await vector.reset({ namespace });
    await vector.deleteNamespace(namespace);
  });

  test(
    "should be able to successfully query html file",
    async () => {
      await ragChat.context.add({
        type: "html",
        source: "./data/the_wonderful_wizard_of_oz_summary.html",
        options: { namespace },
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

describe("RAGChat init with custom model", () => {
  const namespace = "custom-model";
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
    await vector.deleteNamespace(namespace);
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
      constructorInit: "constructor-constructor-init",
      chatOptions: "constructor-chat-options",
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

describe("RAGChat - chat usage with disabled RAG ", () => {
  const namespace = "disabled-rag";
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });
  const redis = Redis.fromEnv();

  const ragChat = new RAGChat({
    vector,
    namespace,
    streaming: false,
    redis,
    model: custom("meta-llama/Meta-Llama-3-8B-Instruct", {
      apiKey: process.env.QSTASH_TOKEN!,
      baseUrl: "https://qstash.upstash.io/llm/v1",
    }),
  });

  afterAll(async () => {
    await redis.flushdb();
    await vector.reset({ namespace });
    await vector.deleteNamespace(namespace);
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
    "should be able to chat without rag and ask question with default disabled rag chat prompt",
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
  const namespace = "result-metadata";
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });

  const ragChat = new RAGChat({
    vector,
    namespace,
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

describe("RAG Chat with Vercel AI SDK", () => {
  const namespace = "ai-sdk";
  const sessionId = "ai-sdk-session";
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });

  const redis = new Redis({
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    url: process.env.UPSTASH_REDIS_REST_URL!,
  });

  const ragChat = new RAGChat({
    model: openai("gpt-3.5-turbo"),
    vector,
    namespace,
    redis,
    sessionId,
  });

  beforeAll(async () => {
    await ragChat.context.add({
      type: "text",
      data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
      options: { namespace },
    });
    await awaitUntilIndexed(vector);
    await redis.flushdb();
  });

  afterAll(async () => {
    await vector.reset({ namespace });
    await vector.deleteNamespace(namespace);
    await redis.flushdb();
  });

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

describe("RAG Chat with disableHistory option", () => {
  const namespace = "disable-history";
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });

  const redis = new Redis({
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    url: process.env.UPSTASH_REDIS_REST_URL!,
  });

  const ragChat = new RAGChat({
    model: new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: false,
      verbose: false,
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
      configuration: {
        organization: process.env.OPENAI_ORGANIZATION,
      },
    }),
    vector,
    redis,
    namespace,
  });

  const testSessionId = "test-disable-history-session";
  let getMessagesSpy: Mock<typeof ragChat.history.getMessages>;

  beforeAll(async () => {
    await ragChat.context.add({
      type: "text",
      data: "The capital of France is Paris.",
      options: { namespace },
    });
    await awaitUntilIndexed(vector);
    await redis.flushdb();
  });

  beforeEach(() => {
    getMessagesSpy = spyOn(ragChat.history, "getMessages");
  });

  afterEach(() => {
    getMessagesSpy.mockRestore();
  });

  afterAll(async () => {
    await vector.reset({ namespace });
    await vector.deleteNamespace(namespace);
  });

  afterEach(async () => {
    await redis.flushdb();
  });

  test("should not store chat history when disableHistory is true", async () => {
    const question = "What is the capital of France?";
    await ragChat.chat(question, {
      streaming: false,
      sessionId: testSessionId,
      disableHistory: true,
    });

    const history = await ragChat.history.getMessages({ sessionId: testSessionId });
    expect(history.length).toBe(0);
  });

  test("should not affect context retrieval when disableHistory is true", async () => {
    const question = "What is the capital of France?";
    const result = await ragChat.chat(question, {
      streaming: false,
      disableHistory: true,
    });

    expect(result.output.toLowerCase()).toContain("paris");
  });

  test("should work correctly with multiple sequential chats and varying disableHistory", async () => {
    const sessionId = "multi-chat-session";

    // First chat with disableHistory true
    await ragChat.chat("What is the capital of France?", {
      streaming: false,
      sessionId,
      disableHistory: true,
    });

    // Second chat with disableHistory false
    await ragChat.chat("What is the capital of Italy?", {
      streaming: false,
      sessionId,
      disableHistory: false,
    });

    // Third chat with disableHistory true
    await ragChat.chat("What is the capital of Germany?", {
      streaming: false,
      sessionId,
      disableHistory: true,
    });

    const history = await ragChat.history.getMessages({ sessionId });
    const expectedHistoryLength = 2; // Only the assistant and user message of the second chat should be stored
    expect(history.length).toBe(expectedHistoryLength);
    expect([history[0].content, history[1].content]).toContain("What is the capital of Italy?");
  });

  test("should not call Redis when disableHistory is true", async () => {
    const question = "What is the capital of France?";
    await ragChat.chat(question, {
      streaming: false,
      sessionId: testSessionId,
      disableHistory: true,
    });

    expect(getMessagesSpy).not.toHaveBeenCalled();
  });

  test("should call Redis when disableHistory is false", async () => {
    const question = "What is the capital of France?";
    await ragChat.chat(question, {
      streaming: false,
      sessionId: testSessionId,
      disableHistory: false,
    });

    expect(getMessagesSpy).toHaveBeenCalled();
  });
});

describe("RAG Chat with non-embedding db", () => {
  const namespace = "non-embedding";
  const vector = new Index({
    token: process.env.NON_EMBEDDING_UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.NON_EMBEDDING_UPSTASH_VECTOR_REST_URL!,
  });

  const redis = new Redis({
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    url: process.env.UPSTASH_REDIS_REST_URL!,
  });

  const ragChat = new RAGChat({
    model: new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: false,
      verbose: false,
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
      configuration: {
        organization: process.env.OPENAI_ORGANIZATION,
      },
    }),
    vector,
    redis,
    namespace,
  });

  beforeAll(async () => {
    await vector.reset({ namespace });
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    await new Promise((r) => setTimeout(r, 1000));
  });

  test("should upsert embedding and query it", async () => {
    await ragChat.context.addMany([
      {
        id: 1,
        type: "embedding",
        data: [1, 1, 0],
        text: "first embedding",
        options: { namespace },
      },
      {
        id: 2,
        type: "embedding",
        data: [1, 0, 1],
        text: "second embedding",
        options: { namespace },
      },
    ]);

    await awaitUntilIndexed(vector);

    let called = false;
    const onContextFetched = (context: PrepareChatResult) => {
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      expect(context.length).toBe(2);

      expect(context[0].data).toBe("second embedding");
      expect(context[0].id).toBe("2");

      expect(context[1].data).toBe("first embedding");
      expect(context[1].id).toBe("1");

      called = true;
      return context;
    };

    await ragChat.chat("hello world!", {
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      embedding: [0, 0, 0.5],
      onContextFetched,
      namespace,
    });

    expect(called).toBeTrue();
  });
});

describe("RAGChat - context filtering", () => {
  const namespace = "context-filtering";
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });

  const ragChat = new RAGChat({
    vector,
    namespace,
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
        contextFilter: "unit = 'Samurai'",
      });

      expect(result.metadata).toEqual([
        {
          unit: "Samurai",
        },
      ]);
    },
    { timeout: 30_000 }
  );
});
