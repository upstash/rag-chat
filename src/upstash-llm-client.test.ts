/* eslint-disable unicorn/numeric-separators-style */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { AIMessage } from "@langchain/core/messages";
import { Redis } from "@upstash/redis";
import { Index } from "@upstash/vector";
import type { StreamingTextResponse } from "ai";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { RAGChat } from "./rag-chat";
import { awaitUntilIndexed } from "./test-utils";
import { UpstashLLMClient } from "./upstash-llm-client";

describe("RAG Chat with Upstash LLM Client", () => {
  const vector = new Index({
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    url: process.env.UPSTASH_VECTOR_REST_URL!,
  });
  afterAll(async () => await vector.reset());

  describe("meta-llama/Meta-Llama-3-8B-Instruct", () => {
    const client = new UpstashLLMClient({
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      apiKey: process.env.UPSTASH_LLM_REST_TOKEN!,
      streaming: true,
    });

    const ragChat = new RAGChat({
      model: client,
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

    test(
      "should get result without streaming",
      async () => {
        const result = (await ragChat.chat(
          "What year was the construction of the Eiffel Tower completed, and what is its height?",
          { stream: false }
        )) as AIMessage;

        expect(result.content).toContain("330");
      },
      { timeout: 10000 }
    );

    test(
      "should get result with streaming",
      async () => {
        const result = (await ragChat.chat(
          "Which famous artworks can be found in the Louvre Museum?",
          {
            stream: true,
          }
        )) as StreamingTextResponse;

        expect(result).toBeTruthy();
      },
      { timeout: 10000 }
    );
  });

  describe("mistralai/Mistral-7B-Instruct-v0.2", () => {
    const client = new UpstashLLMClient({
      model: "mistralai/Mistral-7B-Instruct-v0.2",
      apiKey: process.env.UPSTASH_LLM_REST_TOKEN!,
      streaming: true,
    });

    const ragChat = new RAGChat({
      model: client,
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

    // afterAll(async () => await vector.reset());

    test(
      "should get result without streaming",
      async () => {
        const result = (await ragChat.chat(
          "What year was the construction of the Eiffel Tower completed, and what is its height?",
          { stream: false }
        )) as AIMessage;

        expect(result.content).toContain("330");
      },
      { timeout: 10000 }
    );

    test(
      "should get result with streaming",
      async () => {
        const result = (await ragChat.chat(
          "Which famous artworks can be found in the Louvre Museum?",
          {
            stream: true,
          }
        )) as StreamingTextResponse;

        expect(result).toBeTruthy();
      },
      { timeout: 10000 }
    );
  });
});
