import type { Index, Redis } from "@upstash/sdk";
import type { Config } from "./config";

import { Upstash } from "@upstash/sdk";
import { RedisClient } from "./clients/redis";
import { VectorClient } from "./clients/vector";
import { InternalUpstashError } from "./error/internal";

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
    let redis: Redis | undefined;
    let vector: Index | undefined;

    if (options.redis) {
      redis = await this.createRedisClient();
      if (!redis) {
        throw new InternalUpstashError("Couldn't initialize Redis client");
      }
    }

    if (options.vector) {
      vector = await this.createVectorClient();
      if (!vector) {
        throw new InternalUpstashError("Couldn't initialize Vector client");
      }
    }

    return { redis, vector } as {
      redis: TInit["redis"] extends true ? Redis : undefined;
      vector: TInit["vector"] extends true ? Index : undefined;
    };
  }
}
