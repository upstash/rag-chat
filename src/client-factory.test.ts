/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Upstash } from "@upstash/sdk";
import { describe, expect, test } from "bun:test";
import type { ClientFactoryConfig } from "./client-factory";
import { ClientFactory } from "./client-factory";

describe("ClientFactory Tests", () => {
  const config: ClientFactoryConfig = {
    email: process.env.UPSTASH_EMAIL!,
    token: process.env.UPSTASH_TOKEN!,
    region: "us-east-1",
    redis: "test-rag-chat-client-factor-redis",
    vector: "test-rag-chat-client-factor-vector",
  };
  const upstash = new Upstash(config);
  const clientFactory = new ClientFactory(config);

  test(
    "Redis client initialization",
    async () => {
      const initialized = await clientFactory.init({ redis: true });
      expect(initialized).toHaveProperty("redis");
      expect(initialized.vector).toBeUndefined();

      await upstash.deleteRedisDatabase("test-rag-chat-client-factor-redis");
    },
    { timeout: 30_000 }
  );

  test(
    "Vector client initialization",
    async () => {
      const initialized = await clientFactory.init({ vector: true });
      expect(initialized).toHaveProperty("vector");
      expect(initialized.redis).toBeUndefined();

      await upstash.deleteVectorIndex("test-rag-chat-client-factor-vector");
    },
    { timeout: 30_000 }
  );
});
