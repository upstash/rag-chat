import { expect, test } from "bun:test";
import { CustomInMemoryChatMessageHistory } from "./in-memory-custom-history";

test("should give last 3 messages from in-memory", async () => {
  const messageHistoryLength = 3;
  const history = new CustomInMemoryChatMessageHistory([], messageHistoryLength);
  await history.addUserMessage("Hello!");
  await history.addAIMessage("Hello, human.");
  await history.addUserMessage("Whats your name?");
  await history.addAIMessage("Upstash");
  await history.addUserMessage("Good.");

  // eslint-disable-next-line unicorn/no-await-expression-member
  const final = (await history.getMessages()).map((message) => message.content as string);
  expect(["Whats your name?", "Upstash", "Good."]).toEqual(final);
});

test("should give all the messages", async () => {
  const history = new CustomInMemoryChatMessageHistory();
  await history.addUserMessage("Hello!");
  await history.addAIMessage("Hello, human.");
  await history.addUserMessage("Whats your name?");
  await history.addAIMessage("Upstash");
  await history.addUserMessage("Good.");

  // eslint-disable-next-line unicorn/no-await-expression-member
  const final = (await history.getMessages()).map((message) => message.content as string);
  expect(["Hello!", "Hello, human.", "Whats your name?", "Upstash", "Good."]).toEqual(final);
});
