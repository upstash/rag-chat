import type { Ratelimit } from "@upstash/ratelimit";

export class RateLimitService {
  private ratelimit?: Ratelimit;

  constructor(ratelimit?: Ratelimit) {
    this.ratelimit = ratelimit;
  }

  async checkLimit(sessionId: string) {
    if (!this.ratelimit) {
      // If no ratelimit object is provided, always allow the operation.
      return {
        success: true,
        limit: -1,
        remaining: -1,
        pending: Promise.resolve(),
        reset: -1,
      };
    }

    const result = await this.ratelimit.limit(sessionId);

    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
      limit: result.limit,
      pending: result.pending,
      reason: result.reason,
    };
  }
}
