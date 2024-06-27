# Upstash RAG Chat SDK

The `@upstash/rag-chat` package makes it easy to develop powerful retrieval-augmented generation (RAG) chat applications with minimal setup and configuration.

Features:

- Next.js compatibility with streaming support
- Ingest entire websites, PDFs and more out of the box
- Built-in Vector store for your knowledge base
- Built-in Redis compatibility for fast chat history management

## Getting started

### Installation

Choose your package manager:

```sh
pnpm add @upstash/rag-chat

bun add @upstash/rag-chat

npm i @upstash/rag-chat
```

### Quick start

1. Set up your environment variables:

```sh
UPSTASH_VECTOR_REST_URL="XXXXX"
UPSTASH_VECTOR_REST_TOKEN="XXXXX"

# OPTIONAL - Otherwise kept in-memory automatically
UPSTASH_REDIS_REST_URL="XXXXX"
UPSTASH_REDIS_REST_TOKEN="XXXXX"
```

2. Initialize and use RAGChat:

```typescript
import { RAGChat } from "@upstash/rag-chat";

const ragChat = new RAGChat();

await ragChat.chat("Tell me about machine learning", { streaming: true });
```

### Choosing a Model to chat with

RAGChat supports both Upstash-hosted models and all OpenAI models out of the box:

```typescript
import { RAGChat, openaiModel } from "@upstash/rag-chat";

export const ragChat = new RAGChat({
  model: openaiModel("gpt-4-turbo"),
});
```

or to use Upstash-hosted open-source models:

```typescript
import { RAGChat, upstashModel } from "@upstash/rag-chat";

export const ragChat = new RAGChat({
  model: upstashModel("mistralai/Mistral-7B-Instruct-v0.2"),
});
```

<details>
  <summary>Where do I find my Upstash API key?</summary><br>

- Navigate to your [Upstash QStash Console](https://console.upstash.com/qstash).
- Scroll down to the **Environment Keys** section and copy the `QSTASH_TOKEN` to your `.env` file.
- ![QStash Credentials](./img/qstash.png)

</details>

### Configuration options

This package offers extensive customization options. Here's an example of a more custom setup:

```typescript
import { RAGChat, openaiModel } from "@upstash/rag-chat";

export const ragChat = new RAGChat({
  model: openaiModel("gpt-4-turbo"),
  prompt: ({ context, question, chatHistory }) =>
    `You are an AI assistant with access to an Upstash Vector Store.
Use the provided context and chat history to answer the question.
If the answer isn't available, politely inform the user.

Chat history:
${chatHistory}

Context:
${context}

Question: ${question}
Answer:`,
});
```

### Adding knowledge to your chat

Easily add different types of data to your RAG application:

```typescript
await ragChat.context.add({
  dataType: "text",
  data: "The speed of light is approximately 299,792,458 meters per second.",
});
```

```typescript
await ragChat.context.add({
  dataType: "pdf",
  fileSource: "./data/quantum_computing_basics.pdf",

  // optional 👇: only add this knowledge to a specific namespace
  options: { namespace: "user-123-documents" },
});
```

```typescript
await ragChat.context.add({
  dataType: "html",
  fileSource: "https://en.wikipedia.org/wiki/Quantum_computing",

  // optional 👇: custom page parsing settings
  config: { chunkOverlap: 50, chunkSize: 200 },
});
```

Each addition to your context returns the IDs of the created documents, in case you ever want to delete them later:

```typescript
await ragChat.context.delete({ id: "1", namespace: "..." });
```

or deleting multiple documents:

## Handling responses

If a response is not streamed, you can simply grab the string output to display in your application:

```typescript
const { output } = await ragChat.chat("How are you", { streaming: false });
```

As you can see by checking your message history, the AI response is automatically added to the message history:

```typescript
const history = await ragChat.history.getMessages({ amount: 10 });
console.log(history);
```
