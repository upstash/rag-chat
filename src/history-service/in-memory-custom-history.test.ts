import { expect, test } from "bun:test";
import { InMemoryHistory } from "./in-memory-history";

test.skip("should give last 3 messages from in-memory", async () => {
  const messageHistoryLength = 3;
  const history = new InMemoryHistory();
  await history.addMessage({ message: { content: "Hello!", role: "user" } });
  await history.addMessage({ message: { content: "Hello, human.", role: "assistant" } });
  await history.addMessage({ message: { content: "What's your name?", role: "user" } });
  await history.addMessage({ message: { content: "Upstash", role: "assistant" } });
  await history.addMessage({ message: { content: "Good.", role: "user" } });

  // eslint-disable-next-line unicorn/no-await-expression-member
  const final = (await history.getMessages({ amount: messageHistoryLength })).map(
    (message) => message.content
  );
  expect(["Whats your name?", "Upstash", "Good."]).toEqual(final);
});

test.skip("should give all the messages", async () => {
  const history = new InMemoryHistory();
  await history.addMessage({ message: { content: "Hello!", role: "user" } });
  await history.addMessage({ message: { content: "Hello, human.", role: "assistant" } });
  await history.addMessage({ message: { content: "What's your name?", role: "user" } });
  await history.addMessage({ message: { content: "Upstash", role: "assistant" } });
  await history.addMessage({ message: { content: "Good.", role: "user" } });

  // eslint-disable-next-line unicorn/no-await-expression-member
  const final = (await history.getMessages({ amount: 5 })).map((message) => message.content);
  expect(["Hello!", "Hello, human.", "Whats your name?", "Upstash", "Good."]).toEqual(final);
});
