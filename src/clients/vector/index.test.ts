/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Upstash } from "@upstash/sdk";
import { describe, expect, test } from "bun:test";
import { VectorClient, DEFAULT_VECTOR_CONFIG } from ".";
import { DEFAULT_VECTOR_DB_NAME } from "../../constants";

const upstashSDK = new Upstash({
  email: process.env.UPSTASH_EMAIL!,
  token: process.env.UPSTASH_TOKEN!,
});

describe("Vector Client", () => {
  test(
    "Initialize client without index name",
    async () => {
      const constructor = new VectorClient({
        upstashSDK: upstashSDK,
      });
      const vectorClient = await constructor.getVectorClient();

      expect(vectorClient).toBeTruthy();

      await upstashSDK.deleteVectorIndex(DEFAULT_VECTOR_DB_NAME);
    },
    { timeout: 30_000 }
  );

  test(
    "Initialize client with db name",
    async () => {
      const constructor = new VectorClient({
        upstashSDK: upstashSDK,
        indexNameOrInstance: "test-name",
      });
      const redisClient = await constructor.getVectorClient();

      expect(redisClient).toBeTruthy();

      await upstashSDK.deleteVectorIndex("test-name");
    },
    { timeout: 30_000 }
  );

  test(
    "Initialize client with existing instance",
    async () => {
      const indexName = DEFAULT_VECTOR_CONFIG.name + "suffix";
      const vectorInstance = await upstashSDK.createVectorIndex({
        ...DEFAULT_VECTOR_CONFIG,
        name: indexName,
        type: "payg",
      });
      const existingVectorClient = await upstashSDK.newVectorClient(vectorInstance.name);

      const constructor = new VectorClient({
        upstashSDK: upstashSDK,
        indexNameOrInstance: existingVectorClient,
      });
      const vectorClient = await constructor.getVectorClient();

      expect(vectorClient).toBeTruthy();

      await upstashSDK.deleteVectorIndex(indexName);
    },
    { timeout: 30_000 }
  );
});
