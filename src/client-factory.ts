/* eslint-disable unicorn/no-useless-undefined */
import type { Index, Redis } from "@upstash/sdk";
import type { Config } from "./config";

import { Upstash } from "@upstash/sdk";
import { RedisClient } from "./clients/redis";
import { VectorClient } from "./clients/vector";

export type ClientFactoryConfig = Pick<Config, "email" | "token" | "vector" | "redis" | "region">;
export class ClientFactory {
  private upstashSDK: Upstash;
  private config: ClientFactoryConfig;

  constructor(config: ClientFactoryConfig) {
    this.upstashSDK = new Upstash(config);
    this.config = config;
  }
  private createVectorClient(): Promise<Index | undefined> {
    return new VectorClient({
      upstashSDK: this.upstashSDK,
      indexNameOrInstance: this.config.vector,
      region: this.config.region,
    }).getVectorClient();
  }

  private createRedisClient(): Promise<Redis | undefined> {
    return new RedisClient({
      upstashSDK: this.upstashSDK,
      redisDbNameOrInstance: this.config.redis,
      region: this.config.region,
    }).getRedisClient();
  }

  /** Allows initting only desired clients. Reason is that in some cases like `HistoryService` we only require
   * redis client, but in `RAGChat` we need all three clients to work efficiently.
   *
   * @default redis: false
   * @default vector: false
   * @default ratelimit: false
   */
  async init<TInit extends { redis?: boolean; vector?: boolean }>(
    options: TInit = { redis: false, vector: false } as TInit
  ): Promise<{
    redis: TInit["redis"] extends true ? Redis : undefined;
    vector: TInit["vector"] extends true ? Index : undefined;
  }> {
    let redisPromise: Promise<Redis | undefined> = Promise.resolve(undefined);
    let vectorPromise: Promise<Index | undefined> = Promise.resolve(undefined);

    if (options.redis) {
      redisPromise = this.createRedisClient();
    }

    if (options.vector) {
      vectorPromise = this.createVectorClient();
    }

    const [redis, vector] = await Promise.all([redisPromise, vectorPromise]);

    return { redis, vector } as {
      redis: TInit["redis"] extends true ? Redis : undefined;
      vector: TInit["vector"] extends true ? Index : undefined;
    };
  }
}
