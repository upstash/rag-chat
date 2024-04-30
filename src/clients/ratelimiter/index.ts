import { Ratelimit } from "@upstash/sdk";

import type { Redis, Upstash } from "@upstash/sdk";
import { InternalUpstashError } from "../../error/internal";

const DEFAULT_RATELIMITER_NAME = "@upstash-rag-chat-ratelimit";
const MAX_ALLOWED_CHAT_REQUEST = 10;

export class RatelimiterClientConstructor {
  private redisClient?: Redis;
  private ratelimiterClient?: Ratelimit;
  private sdkClient: Upstash;

  constructor(sdkClient: Upstash, redisClient?: Redis) {
    this.redisClient = redisClient;
    this.sdkClient = sdkClient;
  }

  public async getRatelimiterClient(): Promise<Ratelimit | undefined> {
    if (!this.ratelimiterClient) {
      try {
        await this.initializeRatelimiterClient();
      } catch (error) {
        console.error("Failed to initialize Ratelimiter client:", error);
        return undefined;
      }
    }
    return this.ratelimiterClient;
  }

  private initializeRatelimiterClient = async () => {
    if (!this.redisClient)
      throw new InternalUpstashError("Redis client is in missing in initializeRatelimiterClient!");

    const ratelimiter = await this.sdkClient.newRatelimitClient(this.redisClient, {
      limiter: Ratelimit.tokenBucket(MAX_ALLOWED_CHAT_REQUEST, "1d", MAX_ALLOWED_CHAT_REQUEST),
      prefix: DEFAULT_RATELIMITER_NAME,
    });

    this.ratelimiterClient = ratelimiter;
  };
}
