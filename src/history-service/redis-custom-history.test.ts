import { Redis } from "@upstash/redis";
import { afterAll, describe, expect, test } from "bun:test";
import { UpstashRedisHistory } from "./redis-custom-history";

describe("Redis chat-history", () => {
  const redis = Redis.fromEnv();
  afterAll(async () => {
    await redis.flushdb();
  });

  test("should give last 3 messages from redis", async () => {
    const history = new UpstashRedisHistory({
      client: redis,
    });
    await history.addMessage({ message: { content: "Hello!", role: "user" } });
    await history.addMessage({ message: { content: "Hello, human.", role: "assistant" } });
    await history.addMessage({ message: { content: "Whats your name?", role: "user" } });
    await history.addMessage({ message: { content: "Upstash", role: "assistant" } });
    await history.addMessage({ message: { content: "Good. How are you?", role: "user" } });
    await history.addMessage({ message: { content: "I'm good. Thanks.", role: "assistant" } });

    const messages = await history.getMessages({ amount: 3 });
    const final = messages.map((message) => message.content);
    expect(["Upstash", "Good. How are you?", "I'm good. Thanks."]).toEqual(final);
  });
});
