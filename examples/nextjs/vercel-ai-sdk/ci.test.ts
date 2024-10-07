import { test, expect } from "bun:test";
import { Redis } from "@upstash/redis";
import { Index } from "@upstash/vector";

const deploymentURL = process.env.DEPLOYMENT_URL;
if (!deploymentURL) {
  throw new Error("DEPLOYMENT_URL not set");
}

async function collectStream(response: Response): Promise<string> {
  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let content = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    // Decode the stream chunk and append it to the content
    const chunk = decoder.decode(value, { stream: true });
    content += chunk;
  }

  // Return the fully collected content
  return content;
}

async function invokeAddData() {
  return await fetch(`${deploymentURL}/api/add-data`, {
    body: null,
    method: "POST",
  });
}

async function invokeChat(userMessage: string) {
  return await fetch(`${deploymentURL}/api/chat`, {
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    }),
    method: "POST",
  });
}

async function resetResources() {
  const redis = Redis.fromEnv();
  await redis.flushdb();

  const index = new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN,
  });
  await index.reset({ all: true });
  // wait for indexing
  await new Promise((r) => setTimeout(r, 2000));
}

test(
  "should invoke server actions",
  async () => {
    await resetResources();
    console.log("reset resources");

    await invokeAddData();
    console.log("loaded data");

    const chatStream = await invokeChat("How is paris often called?");
    console.log("invoked chat");

    const result = await collectStream(chatStream);
    console.log("streamed response");
    console.log(result);

    const lowerCaseResult = result.toLowerCase();

    expect(lowerCaseResult.includes("city")).toBeTrue();
    expect(lowerCaseResult.includes("of")).toBeTrue();
    expect(lowerCaseResult.includes("light")).toBeTrue();
  },
  { timeout: 20_000 }
);
