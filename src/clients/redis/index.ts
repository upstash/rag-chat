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
  sdkClient: Upstash;
  redisDbNameOrInstance?: string | Redis;
  preferredRegion?: PreferredRegions;
};

export class RedisClientConstructor {
  private redisDbNameOrInstance?: string | Redis;
  private preferredRegion?: PreferredRegions;
  private sdkClient: Upstash;
  private redisClient?: Redis;

  constructor({ sdkClient, preferredRegion, redisDbNameOrInstance }: Config) {
    this.redisDbNameOrInstance = redisDbNameOrInstance;
    this.sdkClient = sdkClient;
    this.preferredRegion = preferredRegion ?? "us-east-1";
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
      const redis = await this.sdkClient.getRedisDatabase(redisDbName);
      this.redisClient = await this.sdkClient.newRedisClient(redis.database_name);
    } catch {
      await this.createRedisClientByDefaultConfig(redisDbName);
    }
  };

  private createRedisClientByDefaultConfig = async (redisDbName?: string) => {
    const redisDatabase = await this.sdkClient.getOrCreateRedisDatabase({
      ...DEFAULT_REDIS_CONFIG,
      name: redisDbName ?? DEFAULT_REDIS_CONFIG.name,
      region: this.preferredRegion ?? DEFAULT_REDIS_CONFIG.region,
    });

    if (redisDatabase?.database_name) {
      this.redisClient = await this.sdkClient.newRedisClient(redisDatabase.database_name);
    }
  };
}
