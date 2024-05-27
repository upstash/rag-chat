# Upstash RAG Chat SDK

The `@upstash/rag-chat` SDK simplifies RAG (retrieval-augmented generation) chat development.

Features:

- Creates a Redis instance for your chat history, fully configurable.
- Creates a Vector store for your knowledge base.
- Integrates with Next.js using streams and is compatible with other frameworks.
- Leverages LangChain, Vercel AI SDK, and Upstash products.
- Allows you to add various data types into your Vector store.

## Installation

```sh
pnpm add @upstash/vector @uptash/index @upstash/rag-chat

bun add @upstash/vector @uptash/index @upstash/rag-chat

npm i @upstash/vector @uptash/index @upstash/rag-chat
```

### Basic Usage of Initilization and `chat()`

If you are planning to use the most basic version of our SDK, make sure you have those files in your `.env`.

```sh
UPSTASH_VECTOR_REST_URL="XXXXX"
UPSTASH_VECTOR_REST_TOKEN="XXXXX"

UPSTASH_REDIS_REST_URL="XXXXX"
UPSTASH_REDIS_REST_TOKEN="XXXXX"
```

Now, you are all set. Required Redis and Vector instances will be created for you.

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { Index } from "@upstash/vector";
import { Redis } from "@upstash/redis";

const ragChat = new RAGChat({
  model: new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    streaming: true,
    verbose: false,
    temperature: 0,
    apiKey: "XXXXX",
  }),
});
await ragchat.chat("Say Hello To My Little Friend", { stream: true });
```

### Advance Usage of Initilization and `chat()`

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { Index } from "@upstash/vector";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const ragChat = new RAGChat({
  model: new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    streaming: false,
    verbose: false,
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
  }),
  vector: new Index(),
  redis: new Redis(),
  prompt: PromptTemplate.fromTemplate("Just say `I'm a cookie monster`. Nothing else."),
  ratelimit: new Ratelimit({
    redis,
    limiter: Ratelimit.tokenBucket(1, "1d", 1),
    prefix: "@upstash/rag-chat-ratelimit",
  }),
});

await ragchat.chat("Say Hello To My Little Friend", {
  stream: true,
  includeHistory: 5,
  ratelimitSessionId: "user-ip",
  sessionId: "chat-session-id",
  similarityThreshold: 0.8,
  topK: 10,
});
```

### Usage of `addContext()`

There are various way to add data into your RAG application, but the most simple one is this:

```typescript
const ragChat = new RAGChat({...});
await ragChat.addContext("Tokyo is the capital of Japan.");

await ragchat.chat("Where is the capital of Japan.", { stream: true });
```

But, you can also add various files:

```typescript
//Adding embeddings
await ragChat.addContext(
  {
    dataType: "embedding",
    data: [{ input: [1, 2, 3, 4], id: "embedding-data", metadata: "My custom embedding data" }], // Metadata value will be mapped your `metadataKey`
  },
  { metadataKey: "text" }
);

// Adding text with better control
await ragChat.addContext(
  {
    dataType: "text",
    data: "Hello there!", //This will also be your metadata
    id: "my-custom-id",
  },
  { metadataKey: "text" }
);

//Adding PDF
await ragChat.addContext({
  dataType: "pdf",
  fileSource: "./data/the_wonderful_wizard_of_oz.pdf",
  opts: { chunkSize: 500, chunkOverlap: 50 },
});

//Adding CSV
await ragChat.addContext({
  dataType: "csv",
  fileSource: "./data/list_of_user_info.csv",
});

//Adding TXT
await ragChat.addContext({
  dataType: "text-file",
  fileSource: "./data/the_wonderful_wizard_of_oz_summary.txt",
  opts: { chunkSize: 500, chunkOverlap: 50 },
});

//Adding HTML
await ragChat.addContext({
  dataType: "html",
  fileSource: "./data/the_wonderful_wizard_of_oz_summary.html",
});

//You can even add remote HTML page, but this requires OpenAI key in order to organize the content on the page.
await ragChat.addContext({
  dataType: "html",
  fileSource: "https://en.wikipedia.org/wiki/Tokyo",
});
```
