import type { Env } from "hono/types";
import app from "./router";

export default {
  async fetch(request: Request, environment: Env, context: ExecutionContext): Promise<Response> {
    return app.fetch(request, environment, context);
  },
};
