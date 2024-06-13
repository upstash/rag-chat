import { expect, test } from "bun:test";
import { CustomInMemoryChatMessageHistory } from "./in-memory-custom-history";

test("should give last 3 messages from in-memory", async () => {
  const messageHistoryLength = 3;
  const history = new CustomInMemoryChatMessageHistory({
    messages: [],
    topLevelChatHistoryLength: messageHistoryLength,
    metadata: { helloWorld: "hey" },
  });
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
  const history = new CustomInMemoryChatMessageHistory({
    messages: [],
    metadata: { helloWorld: "hey" },
  });
  await history.addUserMessage("Hello!");
  await history.addAIMessage("Hello, human.");
  await history.addUserMessage("Whats your name?");
  await history.addAIMessage("Upstash");
  await history.addUserMessage("Good.");

  // eslint-disable-next-line unicorn/no-await-expression-member
  const final = (await history.getMessages()).map((message) => message.content as string);
  expect(["Hello!", "Hello, human.", "Whats your name?", "Upstash", "Good."]).toEqual(final);
});

test("should give all the messages with offset pagination", async () => {
  const history = new CustomInMemoryChatMessageHistory({
    messages: [],
    metadata: { helloWorld: "hey" },
  });
  await history.addUserMessage("Hello!");
  await history.addAIMessage("Hello, human.");
  await history.addUserMessage("Whats your name?");
  await history.addAIMessage("Upstash");
  await history.addUserMessage("Good. How are you?");
  await history.addAIMessage("I'm good. Thanks.");

  // eslint-disable-next-line unicorn/no-await-expression-member
  let final = (await history.getMessages({ offset: 0, length: 2 })).map(
    (message) => message.content as string
  );
  expect(["Upstash", "Good. How are you?", "I'm good. Thanks."]).toEqual(final);

  // eslint-disable-next-line unicorn/no-await-expression-member
  final = (await history.getMessages({ offset: 2, length: 3 })).map(
    (message) => message.content as string
  );
  expect(["Hello!", "Hello, human.", "Whats your name?", "Upstash"]).toEqual(final);
});
