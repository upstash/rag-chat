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

// Calls the serverChat method
async function invokeServerChat(userMessage: string) {
  return await fetch(deploymentURL!, {
    headers: {
      // action corresponding to the serverChat function
      "next-action": "28903c0dd4db486c0277d1ccaca5f14b5c96afcc",
    },
    body: `[{"userMessage":{"content":"${userMessage}","role":"user","id":"1727873501229"}}]`,
    method: "POST",
  });
}

async function invokeServerAddData() {
  return await fetch(deploymentURL!, {
    headers: {
      // action corresponding to the serverAddData function
      "next-action": "d52c88520308e2277e3d15a0dfd0ec4a5c8901fb",
    },
    body: `[]`,
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

    await invokeServerAddData();
    console.log("loaded data");

    const chatStream = await invokeServerChat("How is paris often called?");
    console.log("invoked serverChat");

    const result = await collectStream(chatStream);
    console.log("streamed response");

    const lowerCaseResult = result.toLowerCase();
    console.log(lowerCaseResult);

    expect(lowerCaseResult.includes("city")).toBeTrue();
    expect(lowerCaseResult.includes("of")).toBeTrue();
    expect(lowerCaseResult.includes("light")).toBeTrue();
  },
  { timeout: 20_000 }
);
