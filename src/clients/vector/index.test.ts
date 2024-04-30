/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Upstash } from "@upstash/sdk";
import { describe, expect, test } from "bun:test";
import { DEFAULT_VECTOR_DB_NAME, VectorClientConstructor, DEFAULT_VECTOR_CONFIG } from ".";

const upstashSDK = new Upstash({
  email: process.env.UPSTASH_EMAIL!,
  token: process.env.UPSTASH_TOKEN!,
});

describe("Redis Client", () => {
  test(
    "Initialize client without index name",
    async () => {
      const constructor = new VectorClientConstructor({
        sdkClient: upstashSDK,
      });
      const vectorClient = await constructor.getVectorClient();

      expect(vectorClient).toBeTruthy();

      await upstashSDK.deleteVectorIndex(DEFAULT_VECTOR_DB_NAME);
    },
    { timeout: 10_000 }
  );

  test(
    "Initialize client with db name",
    async () => {
      const constructor = new VectorClientConstructor({
        sdkClient: upstashSDK,
        indexNameOrInstance: "test-name",
      });
      const redisClient = await constructor.getVectorClient();

      expect(redisClient).toBeTruthy();

      await upstashSDK.deleteVectorIndex("test-name");
    },
    { timeout: 10_000 }
  );

  test(
    "Initialize client with existing instance",
    async () => {
      const indexName = DEFAULT_VECTOR_CONFIG.name + "suffix";
      const vectorInstance = await upstashSDK.createVectorIndex({
        ...DEFAULT_VECTOR_CONFIG,
        name: indexName,
      });
      const existingVectorClient = await upstashSDK.newVectorClient(vectorInstance.name);

      const constructor = new VectorClientConstructor({
        sdkClient: upstashSDK,
        indexNameOrInstance: existingVectorClient,
      });
      const vectorClient = await constructor.getVectorClient();

      expect(vectorClient).toBeTruthy();

      await upstashSDK.deleteVectorIndex(indexName);
    },
    { timeout: 10_000 }
  );
});
