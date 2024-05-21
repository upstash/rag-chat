import type { Ratelimit } from "@upstash/ratelimit";

export class RateLimitService {
  private ratelimit?: Ratelimit;

  constructor(ratelimit?: Ratelimit) {
    this.ratelimit = ratelimit;
  }

  async checkLimit(sessionId: string): Promise<{ success: boolean; resetTime?: number }> {
    if (!this.ratelimit) {
      // If no ratelimit object is provided, always allow the operation.
      return { success: true };
    }

    const result = await this.ratelimit.limit(sessionId);
    if (!result.success) {
      return { success: false, resetTime: result.reset };
    }
    return { success: true };
  }
}
