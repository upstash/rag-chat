/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { Index, Redis } from "@upstash/sdk";
import { expect, test } from "bun:test";
import { Config, DEFAULT_REDIS_DB_NAME, DEFAULT_VECTOR_DB_NAME } from "./config";

const mockRedis = new Redis({
  token: "hey",
  url: "redis://arbitrary_usrname:password@ipaddress:6379/0",
});
const mockIndex = new Index({
  token: "hey",
  url: "redis://arbitrary_usrname:password@ipaddress:6379/0",
});

test("Config initializes with defaults", () => {
  const config = new Config(process.env.UPSTASH_EMAIL!, process.env.UPSTASH_TOKEN!, {
    model: new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: true,
      verbose: true,
      temperature: 0,
      apiKey: "asdasd",
    }),
  });

  expect(config.email).toBe(process.env.UPSTASH_EMAIL!);
  expect(config.token).toBe(process.env.UPSTASH_TOKEN!);
  expect(config.region).toBe("us-east-1");
  expect(config.vector).toBe(DEFAULT_VECTOR_DB_NAME);
  expect(config.redis).toBe(DEFAULT_REDIS_DB_NAME);
  expect(config.template).toBeUndefined();
});

test("Config initializes with custom parameters", () => {
  const config = new Config(process.env.UPSTASH_EMAIL!, process.env.UPSTASH_TOKEN!, {
    model: new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: true,
      verbose: true,
      temperature: 0,
      apiKey: "asdasd",
    }),
    vector: mockIndex,
    redis: mockRedis,
    region: "eu-west-1",
    template: PromptTemplate.fromTemplate(`asdasd`),
  });

  expect(config.region).toBe("eu-west-1");
  expect(config.vector).toBe(mockIndex);
  expect(config.redis).toBe(mockRedis);
  expect(config.template).toEqual(PromptTemplate.fromTemplate(`asdasd`));
});

test("Config throws error if model is undefined", () => {
  expect(() => new Config(process.env.UPSTASH_EMAIL!, process.env.UPSTASH_TOKEN!)).toThrow(
    "Model can not be undefined!"
  );
});
