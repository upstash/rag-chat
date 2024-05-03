import type { CreateCommandPayload, Upstash } from "@upstash/sdk";

import { Redis } from "@upstash/sdk";
import type { PreferredRegions } from "../../types";

export const DEFAULT_REDIS_DB_NAME = "upstash-rag-chat-redis";

export const DEFAULT_REDIS_CONFIG: CreateCommandPayload = {
  name: DEFAULT_REDIS_DB_NAME,
  tls: true,
  region: "us-east-1",
  eviction: false,
};

type Config = {
  upstashSDK: Upstash;
  redisDbNameOrInstance?: string | Redis;
  region?: PreferredRegions;
};

export class RedisClient {
  private redisDbNameOrInstance?: string | Redis;
  private region?: PreferredRegions;
  private upstashSDK: Upstash;
  private redisClient?: Redis;

  constructor({ upstashSDK, region, redisDbNameOrInstance }: Config) {
    this.redisDbNameOrInstance = redisDbNameOrInstance;
    this.upstashSDK = upstashSDK;
    this.region = region ?? "us-east-1";
  }

  public async getRedisClient(): Promise<Redis | undefined> {
    if (!this.redisClient) {
      try {
        await this.initializeRedisClient();
      } catch (error) {
        console.error("Failed to initialize Redis client:", error);
        return undefined;
      }
    }
    return this.redisClient;
  }

  private initializeRedisClient = async () => {
    const { redisDbNameOrInstance } = this;

    // Direct Redis instance provided
    if (redisDbNameOrInstance instanceof Redis) {
      this.redisClient = redisDbNameOrInstance;
      return;
    }

    // Redis name provided
    if (typeof redisDbNameOrInstance === "string") {
      await this.createRedisClientByName(redisDbNameOrInstance);
      return;
    }

    // No specific Redis information provided, using default configuration
    await this.createRedisClientByDefaultConfig();
  };

  private createRedisClientByName = async (redisDbName: string) => {
    try {
      const redis = await this.upstashSDK.getRedisDatabase(redisDbName);
      this.redisClient = await this.upstashSDK.newRedisClient(redis.database_name);
    } catch {
      console.error(`Requested '${redisDbName}' is missing in DB list. Creating new one...`);
      await this.createRedisClientByDefaultConfig(redisDbName);
    }
  };

  private createRedisClientByDefaultConfig = async (redisDbName?: string) => {
    const redisDatabase = await this.upstashSDK.getOrCreateRedisDatabase({
      ...DEFAULT_REDIS_CONFIG,
      name: redisDbName ?? DEFAULT_REDIS_CONFIG.name,
      region: this.region ?? DEFAULT_REDIS_CONFIG.region,
    });

    if (redisDatabase?.database_name) {
      this.redisClient = await this.upstashSDK.newRedisClient(redisDatabase.database_name);
    }
  };
}
