/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Upstash } from "@upstash/sdk";
import { describe, expect, test } from "bun:test";
import { DEFAULT_REDIS_CONFIG, DEFAULT_REDIS_DB_NAME, RedisClientConstructor } from ".";

const upstashSDK = new Upstash({
  email: process.env.UPSTASH_EMAIL!,
  token: process.env.UPSTASH_TOKEN!,
});

describe("Redis Client", () => {
  test(
    "Initialize client without db name",
    async () => {
      const constructor = new RedisClientConstructor({
        sdkClient: upstashSDK,
      });
      const redisClient = await constructor.getRedisClient();

      expect(redisClient).toBeTruthy();

      await upstashSDK.deleteRedisDatabase(DEFAULT_REDIS_DB_NAME);
    },
    { timeout: 10_000 }
  );

  test(
    "Initialize client with db name",
    async () => {
      const constructor = new RedisClientConstructor({
        sdkClient: upstashSDK,
        redisDbNameOrInstance: "test-name",
      });
      const redisClient = await constructor.getRedisClient();

      expect(redisClient).toBeTruthy();

      await upstashSDK.deleteRedisDatabase("test-name");
    },
    { timeout: 10_000 }
  );

  test(
    "Initialize client with existing instance",
    async () => {
      const dbName = DEFAULT_REDIS_CONFIG.name + "suffix";
      const redisInstance = await upstashSDK.createRedisDatabase({
        ...DEFAULT_REDIS_CONFIG,
        name: dbName,
      });
      const existingRedisClient = await upstashSDK.newRedisClient(redisInstance.database_name);

      const constructor = new RedisClientConstructor({
        sdkClient: upstashSDK,
        redisDbNameOrInstance: existingRedisClient,
      });
      const redisClient = await constructor.getRedisClient();

      expect(redisClient).toBeTruthy();

      await upstashSDK.deleteRedisDatabase(dbName);
    },
    { timeout: 10_000 }
  );
});
