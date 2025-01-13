# RAG Chat SDK &middot; ![license](https://img.shields.io/npm/l/%40upstash%2Frag-chat) ![npm (scoped)](https://img.shields.io/npm/v/@upstash/rag-chat) ![npm weekly download](https://img.shields.io/npm/dw/%40upstash%2Frag-chat)


> [!NOTE]  
> **This project is a Community Project.**
>
> The project is maintained and supported by the community. Upstash may contribute but does not officially support or assume responsibility for it.

> [!NOTE]  
> **Recommendation from the Upstash Team**
>
> The RAG Chat SDK is designed to create prototypes more easily and quickly. For real projects, use Langchain, LlamaIndex, and the Vercel AI SDK.



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
- [gettingstarted](docs/gettingstarted.mdx)
- [how-to](docs/how-to.mdx)
- [api](docs/api.mdx)
- [config](docs/config.mdx)
- [debug](docs/debug.mdx)
- [features](docs/features.mdx)

### Integrations
- [anthropic](docs/integrations/anthropic.mdx)
- [custom](docs/integrations/custom.mdx)
- [groq](docs/integrations/groq.mdx)
- [helicone](docs/integrations/helicone.mdx)
- [langsmith](docs/integrations/langsmith.mdx)
- [mistralai](docs/integrations/mistralai.mdx)
- [nextjs](docs/integrations/nextjs.mdx)
- [ollama](docs/integrations/ollama.mdx)
- [open-router](docs/integrations/open-router.mdx)
- [openai](docs/integrations/openai.mdx)
- [overview](docs/integrations/overview.mdx)
- [togetherai](docs/integrations/togetherai.mdx)
- [unstructured](docs/integrations/unstructured.mdx)
- [vercel-ai](docs/integrations/vercel-ai.mdx)

### Quickstarts
- [cloudflare-workers](docs/quickstarts/cloudflare-workers.mdx)
- [hono](docs/quickstarts/hono.mdx)
- [nextjs](docs/quickstarts/nextjs.mdx)
- [nextjs-server-actions](docs/quickstarts/nextjs-server-actions.mdx)
- [nodejs](docs/quickstarts/nodejs.mdx)
- [nuxt](docs/quickstarts/nuxt.mdx)
- [overview](docs/quickstarts/overview.mdx)
- [sveltekit](docs/quickstarts/sveltekit.mdx)

