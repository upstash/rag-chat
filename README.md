# Upstash RAG Chat SDK

The `@upstash/rag-chat` SDK simplifies RAG (retrieval-augmented generation) chat development.

Features:

- Creates a Redis instance for your chat history, fully configurable.
- Creates a Index instance for your knowledge base.
- Integrates with Next.js using streams and is compatible with other frameworks.
- Leverages LangChain, Vercel AI SDK, and Upstash products.

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

// Basic usage
const ragchat = await RAGChat.initialize({
  email: "YOUR_UPSTASH_EMAIL",
  token: "YOUR_UPSTASH_TOKEN,
  model: new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    streaming: true,
    verbose,
    temperature: 0,
    apiKey: "YOUR_OPEN_AI_KEY_HERE",
  }),
});
await ragchat.chat("Say Hello To My Little Friend", { stream: true });

// Advance
const ragchat = await RAGChat.initialize({
  email: process.env.UPSTASH_EMAIL!,
  token: process.env.UPSTASH_TOKEN!,
  model: new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    streaming: true,
    verbose,
    temperature: 0,
    apiKey: "YOUR_OPEN_AI_KEY_HERE",
  }) // Or your can pass any other Langchain compatible LLMs like Gemini, Anthropic, etc...
  vector: new Index(),
  redis: new Redis(),
  ratelimit: new Ratelimit({
    redis,
    limiter: Ratelimit.tokenBucket(10, "1d", 10),
    prefix: "@upstash/rag-chat-ratelimit",
  }),
  region: "us-east-1", // Default to "us-east-1"
  template: PromptTemplate.fromTemplate(
    "Use this history {chat_history} and this context {context}"
  ),
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

In the future, you'll be able to pass your own custom LangChain flows as callbacks, providing better control and flexibility.
