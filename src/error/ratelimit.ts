import type { RATELIMIT_ERROR_MESSAGE } from "../constants";

type RatelimitResponse = {
  error: typeof RATELIMIT_ERROR_MESSAGE;
  resetTime?: number;
};

export class RatelimitUpstashError extends Error {
  constructor(message: string, cause: RatelimitResponse) {
    super(message);
    this.name = "RatelimitError";
    this.cause = cause;
  }
}
