import { Redis } from "@upstash/redis";
import { afterAll, describe, expect, test } from "bun:test";
import { CustomUpstashRedisChatMessageHistory } from "./redis-custom-history";

describe("Redis chat-history", () => {
  const redis = Redis.fromEnv();
  afterAll(async () => {
    await redis.flushdb();
  });

  test("should give last 3 messages from redis", async () => {
    const history = new CustomUpstashRedisChatMessageHistory({
      client: redis,
      metadata: { modelWithProvider: "Mistral" },
      sessionId: "testing-features",
    });
    await history.addUserMessage("Hello!");
    await history.addAIMessage("Hello, human.");
    await history.addUserMessage("Whats your name?");
    await history.addAIMessage("Upstash");
    await history.addUserMessage("Good. How are you?");
    await history.addAIMessage("I'm good. Thanks.");
    const messages = await history.getMessagesForUpstash<{
      modelWithProvider: "llama-3" | "Mistral";
    }>({ offset: 0, length: 2 });

    expect(messages.find((m) => m.metadata.modelWithProvider === "Mistral")).toBeTruthy();
    // eslint-disable-next-line unicorn/no-await-expression-member
    const final = messages.map((message) => message.content);
    expect(["Upstash", "Good. How are you?", "I'm good. Thanks."]).toEqual(final);
  });
});
