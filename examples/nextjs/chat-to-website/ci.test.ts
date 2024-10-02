import { test, expect } from "bun:test";
import { Redis } from "@upstash/redis";
import { Index } from "@upstash/vector";

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

async function invokeLoadPage(
  url = "http://localhost:3000/",
  website = "https://raw.githubusercontent.com/upstash/docs/refs/heads/main/qstash/workflow/basics/caveats.mdx"
) {
  await fetch(`${url}${website}`, { method: "GET" });
}

async function invokeChat(userMessage: string, url = "http://localhost:3000/") {
  return await fetch("http://localhost:3000/api/chat-stream", {
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

const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN,
});

async function resetResources() {
  const redis = Redis.fromEnv();
  await redis.flushdb();

  await index.reset({ all: true });
  // wait for indexing
  await new Promise((r) => setTimeout(r, 2000));
}

test(
  "should invoke chat",
  async () => {
    await resetResources();
    console.log("reset resources");

    await invokeLoadPage();
    console.log("loaded page");

    const indexInfo = await index.info();
    console.log("index info:", indexInfo);

    const chatStream = await invokeChat(
      "can you nest context.run statements? respond with just 'foo' if yes, 'bar' otherwise."
    );
    console.log("invoked chat");

    const result = await collectStream(chatStream);
    console.log("streamed response");

    const lowerCaseResult = result.toLowerCase();
    expect(lowerCaseResult.includes("foo")).toBeTrue();
    expect(lowerCaseResult.includes("bar")).toBeFalse();
  },
  { timeout: 20_000 }
);
