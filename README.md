# Upstash RAG Chat SDK

The `@upstash/rag-chat` package makes it easy to develop powerful retrieval-augmented generation (RAG) chat applications with minimal setup and configuration.

Features:

- Next.js compatibility with streaming support
- Ingest entire websites, PDFs and more out of the box
- Built-in Vector store for your knowledge base
- (Optional) built-in Redis compatibility for fast chat history management
- (Optional) built-in rate limiting
- (Optional) disableRag option to use it as LLM + chat history

## Getting started

### Installation

Install the package using your preferred package manager:

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


# if you use OpenAI compatible models
OPENAI_API_KEY="XXXXX"

# or if you use Upstash hosted models
QSTASH_TOKEN="XXXXX"

# Optional: For Redis-based chat history (default is in-memory)
UPSTASH_REDIS_REST_URL="XXXXX"
UPSTASH_REDIS_REST_TOKEN="XXXXX"
```

2. Initialize and use RAGChat:

```typescript
import { RAGChat } from "@upstash/rag-chat";

const ragChat = new RAGChat();

const response = await ragChat.chat("Tell me about machine learning");
console.log(response);
```

### Configuring Your Chat Model

RAGChat supports both Upstash-hosted models and all OpenAI and OpenAI-compatible models out of the box:

#### Using OpenAI Models

To use an OpenAI model, first initialize RAGChat:

```typescript
import { RAGChat, openai } from "@upstash/rag-chat";

export const ragChat = new RAGChat({
  model: openai("gpt-4-turbo"),
});
```

And set your OpenAI API key as an environment variable:

```bash
OPENAI_API_KEY=...
```

#### Using Upstash-hosted Open-Source Models

To use an Upstash model, first initialize RAGChat:

```typescript
import { RAGChat, upstash } from "@upstash/rag-chat";

export const ragChat = new RAGChat({
  model: upstash("mistralai/Mistral-7B-Instruct-v0.2"),
});
```

And set your Upstash QStash API key environment variable:

```bash
QSTASH_TOKEN=...
```

#### Using Custom Providers - TogetherAi, Replicate

Initialize RAGChat with custom provider's API key and url:

```typescript
import { RAGChat, custom } from "@upstash/rag-chat";

export const ragChat = new RAGChat({
  model: custom("codellama/CodeLlama-70b-Instruct-hf", {
    apiKey: "TOGETHER_AI_API_KEY",
    baseUrl: "https://api.together.xyz/v1",
  }),
});
```

<details>
  <summary>Where do I find my Upstash API key?</summary><br>

- Navigate to your [Upstash QStash Console](https://console.upstash.com/qstash).
- Scroll down to the **Environment Keys** section and copy the `QSTASH_TOKEN` to your `.env` file.
- ![QStash Credentials](./img/qstash.png)

</details>

## Debugging Your RAG Apps

RAGChat provides a powerful debugging feature that allows you to see the inner workings of your RAG applications. By enabling debug mode, you can trace the entire process from user input to final response.

### How to Enable Debugging

To activate the debugging feature, simply initialize RAGChat with the `debug` option set to `true`:

```typescript
new RAGChat({ debug: true });
```

### Understanding the Debug Output

When debug mode is enabled, RAGChat will log detailed information about each step of the RAG process. Here's a breakdown of the debug output:

1. **SEND_PROMPT**: Logs the initial user query.

   ```json
   {
     "timestamp": 1722950191207,
     "logLevel": "INFO",
     "eventType": "SEND_PROMPT",
     "details": {
       "prompt": "Where is the capital of Japan?"
     }
   }
   ```

2. **RETRIEVE_CONTEXT**: Shows the relevant context retrieved from the vector store.

   ```json
   {
     "timestamp": 1722950191480,
     "logLevel": "INFO",
     "eventType": "RETRIEVE_CONTEXT",
     "details": {
       "context": [
         {
           "data": "Tokyo is the Capital of Japan.",
           "id": "F5BWpryYkkcKLrp-GznwK"
         }
       ]
     },
     "latency": "171ms"
   }
   ```

3. **RETRIEVE_HISTORY**: Displays the chat history retrieved for context.

   ```json
   {
     "timestamp": 1722950191727,
     "logLevel": "INFO",
     "eventType": "RETRIEVE_HISTORY",
     "details": {
       "history": [
         {
           "content": "Where is the capital of Japan?",
           "role": "user",
           "id": "0"
         }
       ]
     },
     "latency": "145ms"
   }
   ```

4. **FORMAT_HISTORY**: Shows how the chat history is formatted for the prompt.

   ```json
   {
     "timestamp": 1722950191828,
     "logLevel": "INFO",
     "eventType": "FORMAT_HISTORY",
     "details": {
       "formattedHistory": "USER MESSAGE: Where is the capital of Japan?"
     }
   }
   ```

5. **FINAL_PROMPT**: Displays the complete prompt sent to the language model.

   ```json
   {
     "timestamp": 1722950191931,
     "logLevel": "INFO",
     "eventType": "FINAL_PROMPT",
     "details": {
       "prompt": "You are a friendly AI assistant augmented with an Upstash Vector Store.\n  To help you answer the questions, a context and/or chat history will be provided.\n  Answer the question at the end using only the information available in the context or chat history, either one is ok.\n\n  -------------\n  Chat history:\n  USER MESSAGE: Where is the capital of Japan?\n  -------------\n  Context:\n  - Tokyo is the Capital of Japan.\n  -------------\n\n  Question: Where is the capital of Japan?\n  Helpful answer:"
     }
   }
   ```

6. **LLM_RESPONSE**: Shows the final response from the language model.
   ```json
   {
     "timestamp": 1722950192593,
     "logLevel": "INFO",
     "eventType": "LLM_RESPONSE",
     "details": {
       "response": "According to the context, Tokyo is the capital of Japan!"
     },
     "latency": "558ms"
   }
   ```

### Advanced Configuration

Customize your RAGChat instance with advanced options:

```typescript
import { RAGChat, openai } from "@upstash/rag-chat";

// 👇 Optional: For built-in rate limiting
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const ragChat = new RAGChat({
  model: openai("gpt-4-turbo"),

  promptFn: ({ context, question, chatHistory }) =>
    `You are an AI assistant with access to an Upstash Vector Store.
  Use the provided context and chat history to answer the question.
  If the answer isn't available, politely inform the user.
  ------
  Chat history:
  ${chatHistory}
  ------
  Context:
  ${context}
  ------
  Question: ${question}
  Answer:`,

  ratelimit: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "10 s"),
  }),
});
```

### Managing Your Knowledge Base

Add various types of data to your RAG application:

#### Adding Text

```typescript
await ragChat.context.add({
  type: "text",
  data: "The speed of light is approximately 299,792,458 meters per second.",
});

//OR

await ragChat.context.add("The speed of light is approximately 299,792,458 meters per second.");
```

#### Adding PDF Content

```typescript
await ragChat.context.add({
  type: "pdf",
  fileSource: "./data/quantum_computing_basics.pdf",

  // optional 👇: only add this knowledge to a specific namespace
  options: { namespace: "user-123-documents" },
});
```

#### Adding Web Content

```typescript
await ragChat.context.add({
  type: "html",
  source: "https://en.wikipedia.org/wiki/Quantum_computing",

  // optional 👇: custom page parsing settings
  config: { chunkOverlap: 50, chunkSize: 200 },
});
```

#### Removing Content

Remove specific documents:

```typescript
await ragChat.context.delete({ id: "1", namespace: "user-123-documents" });
```

### Managing Chat History

RAGChat provides robust functionality for interacting with and managing chat history. This allows you to maintain context, review past interactions, and customize the conversation flow.

#### Retrieving Chat History

Fetch recent messages from the chat history:

```typescript
const history = await ragChat.history.getMessages({ amount: 10 });
console.log(history); // 👈 Last (up to) 10 messages
```

You can also specify a session ID to retrieve history for a particular conversation:

```typescript
const sessionHistory = await ragChat.history.getMessages({
  amount: 5,
  sessionId: "user-123-session",
});
```

#### Deleting Chat History

Remove chat history for a specific session:

```typescript
ragChat.history.deleteMessages({ sessionId: "user-123-session" });
```

#### Adding Custom Messages

Injecting custom messages into the chat history:

```typescript
// Adding a user message
await ragChat.history.addMessage({
  message: { content: "What's the weather like?", role: "user" },
});

// Adding a system message
await ragChat.history.addMessage({
  message: {
    content: "The AI should provide weather information.",
    role: "system",
  },
});
```

### Add Observability via Helicone

Helicone is a powerful observability platform that provides valuable insights into your LLM usage. Integrating Helicone with RAGChat is straightforward.

To enable Helicone observability in RAGChat, you simply need to pass your Helicone API key when initializing your model. Here's how to do it for both custom models and OpenAI:

#### For Custom Models (e.g., Meta-Llama)

```ts
import { RAGChat, custom } from "ragchat";

const ragChat = new RAGChat({
  model: custom("meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", {
    apiKey: "xxx",
    baseUrl: "https://api.together.xyz",
    analytics: { name: "helicone", token: process.env.HELICONE_API_KEY! },
  }),
});
```

#### For OpenAI Models

```ts
import { RAGChat, openai } from "ragchat";

const ragChat = new RAGChat({
  model: openai("gpt-3.5-turbo", {
    apiKey: process.env.OPENAI_API_KEY!,
    analytics: { name: "helicone", token: process.env.HELICONE_API_KEY! },
  }),
});
```

## Example usage

### Nextjs route handlers

RAGChat integrates with Next.js route handlers out of the box. Here's how to use it:

#### Basic usage

```typescript
import { ragChat } from "@/utils/rag-chat";
import { NextResponse } from "next/server";

export const POST = async (req: Request) => {
  // 👇 user message
  const { message } = await req.json();
  const { output } = await ragChat.chat(message);
  return NextResponse.json({ output });
};
```

#### Streaming responses

To stream the response from a route handler:

```typescript
import { ragChat } from "@/utils/rag-chat";

export const POST = async (req: Request) => {
  const { message } = await req.json();
  const { output } = await ragChat.chat(message, { streaming: true });
  return new Response(output);
};
```

On the frontend, you can read the streamed data like this:

```typescript
"use client"

export const ChatComponent = () => {
  const [response, setResponse] = useState('');

  async function fetchStream() {
    const response = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "Your question here" }),
    });

    if (!response.body) {
      console.error("No response body");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      setResponse(prev => prev + chunk);
    }
  }

  useEffect(() => {
    fetchStream();
  }, []);

  return <div>{response}</div>;
}
```

### Nextjs server actions

RAGChat supports Next.js server actions natively. First, define your server action:

```typescript
"use server";

import { ragChat } from "@/utils/rag-chat";
import { createServerActionStream } from "@upstash/rag-chat/nextjs";

export const serverChat = async (message: string) => {
  const { output } = await ragChat.chat(message, { streaming: true });

  // 👇 adapter to let us stream from server actions
  return createServerActionStream(output);
};
```

Second, use the server action in your client component:

```typescript
"use client";

import { readServerActionStream } from "@upstash/rag-chat/nextjs";

export const ChatComponent = () => {
  const [response, setResponse] = useState('');

  const clientChat = async () => {
    const stream = await serverChat("How are you?");

    for await (const chunk of readServerActionStream(stream)) {
      setResponse(prev => prev + chunk);
    }
  };

  return (
    <div>
      <button onClick={clientChat}>Start Chat</button>
      <div>{response}</div>
    </div>
  );
};
```

### Vercel AI SDK Integration

RAGChat can be easily integrated with the Vercel AI SDK. First, set up your route handler:

```typescript
import { aiUseChatAdapter } from "@upstash/rag-chat/nextjs";
import { ragChat } from "@/utils/rag-chat";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastMessage = messages[messages.length - 1].content;

  const response = await ragChat.chat(lastMessage, { streaming: true });
  return aiUseChatAdapter(response);
}
```

Second, use the `useChat` hook in your frontend component:

```typescript
"use client"

import { useChat } from "ai/react";

const ChatComponent = () => {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: "/api/chat",
    initialInput: "What year was the construction of the Eiffel Tower completed, and what is its height?",
  });

  return (
    <div>
      <ul>
        {messages.map((m) => (
          <li key={m.id}>{m.content}</li>
        ))}
      </ul>

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask a question..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};
```
