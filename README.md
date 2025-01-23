# RAG Chat SDK &middot; ![license](https://img.shields.io/npm/l/%40upstash%2Frag-chat) 

> [!NOTE]  
> **Recommendation from the Upstash Team**
>
> The RAG Chat SDK is designed to facilitate easier and faster prototype creation. For real projects, use Vercel AI SDK, Langchain, and LlamaIndex.


> [!NOTE]  
> **This project is a Community Project.**
>
> The project is maintained and supported by the community. Upstash may contribute but does not officially support or assume responsibility for it.



The `@upstash/rag-chat` package makes it easy to develop retrieval-augmented generation (RAG) chat applications with minimal setup and configuration.

Features:

- Next.js compatibility with streaming support
- Ingest entire websites, PDFs, and more out of the box
- Built-in vector store for your knowledge base
- (Optional) built-in Redis compatibility for fast chat history management
- (Optional) built-in rate limiting
- (Optional) disableRag option to use it as LLM + chat history
- (Optional) Analytics via [Helicone](https://www.helicone.ai/), [Langsmith](https://www.langchain.com/langsmith), and [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/)

## Getting Started

### Installation

Install the package using your preferred package manager:

```sh
pnpm add @upstash/rag-chat

bun add @upstash/rag-chat

npm i @upstash/rag-chat
```

### Quick Start

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

### Basic Usage

```typescript
import { RAGChat, openai } from "@upstash/rag-chat";

export const ragChat = new RAGChat({
  model: openai("gpt-4-turbo"),
});

await ragChat.context.add({
  type: "text",
  data: "The speed of light is approximately 299,792,458 meters per second.",
});

await ragChat.context.add({
  type: "pdf",
  fileSource: "./data/physics_basics.pdf",
});
const response = await ragChat.chat("What is the speed of light?");

console.log(response.output);
```

## Docs

### General
- [Getting Started](docs/gettingstarted.mdx)
- [How-To](docs/how-to.mdx)
- [API](docs/api.mdx)
- [Config](docs/config.mdx)
- [Debug](docs/debug.mdx)
- [Features](docs/features.mdx)

### Integrations
- [Anthropic](docs/integrations/anthropic.mdx)
- [Custom](docs/integrations/custom.mdx)
- [GROQ](docs/integrations/groq.mdx)
- [Helicone](docs/integrations/helicone.mdx)
- [LangSmith](docs/integrations/langsmith.mdx)
- [Mistral AI](docs/integrations/mistralai.mdx)
- [Next.js](docs/integrations/nextjs.mdx)
- [Ollama](docs/integrations/ollama.mdx)
- [Open Router](docs/integrations/open-router.mdx)
- [OpenAI](docs/integrations/openai.mdx)
- [Overview](docs/integrations/overview.mdx)
- [Together AI](docs/integrations/togetherai.mdx)
- [Unstructured](docs/integrations/unstructured.mdx)
- [Vercel AI](docs/integrations/vercel-ai.mdx)

### Quickstarts
- [Cloudflare Workers](docs/quickstarts/cloudflare-workers.mdx)
- [Hono](docs/quickstarts/hono.mdx)
- [Next.js](docs/quickstarts/nextjs.mdx)
- [Next.js Server Actions](docs/quickstarts/nextjs-server-actions.mdx)
- [Node.js](docs/quickstarts/nodejs.mdx)
- [Nuxt](docs/quickstarts/nuxt.mdx)
- [Overview](docs/quickstarts/overview.mdx)
- [SvelteKit](docs/quickstarts/sveltekit.mdx)

