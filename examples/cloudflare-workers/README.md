# RAGChat with Cloudflare Workers

This project demonstrates how to implement RAGChat (Retrieval-Augmented Generation Chat) using a basic Cloudflare Workers with Hono Router.

The project includes four endpoints:

- `/add-data` to add data to your endpoint.
- `/chat` to make a chat request with rag-chat using Upstash LLM.
- `/chat-stream` to make a chat request with rag-chat using Upstash LLM with streaming.
- `/chat-stream-openai` to make a chat request with rag-chat using OpenAI LLM with streaming.

You can check out the `src/index.ts` file to see how each endpoint works.

For running the app locally, first run `npm install` to install the packages. Then, see the `Set Environment Variables` and `Development` sections below.

## Installation Steps

### 1. Install `rag-chat`

First, install the rag-chat package:

```
npm install @upstash/rag-chat
```

### 2. Configure wrangler.toml

Ensure your wrangler.toml file includes the following configuration to enable Node.js compatibility:

```toml
compatibility_flags = ["nodejs_compat_v2"]
```

In older CF worker versions, you may need to set the following compatibility flags:

```toml
compatibility_flags = [ "streams_enable_constructors", "transformstream_enable_standard_constructor" ]
```

### 3. Set Environment Variables

For local development, create a `.dev.vars` file and populate it with the following variables:

```
UPSTASH_REDIS_REST_URL="***"
UPSTASH_REDIS_REST_TOKEN="***"
UPSTASH_VECTOR_REST_URL="***"
UPSTASH_VECTOR_REST_TOKEN="***"
QSTASH_TOKEN="***"
OPENAI_API_KEY="***"
```

- `QSTASH_TOKEN` is needed for the `/chat` and `/chat-stream` endpoints.
- `OPENAI_API_KEY` is needed for the `/chat-stream-openai` endpoint.

For deployment, use the `wrangler` CLI to securely set environment variables.
Run the following command for each secret:

```
npx wrangler secret put SECRET_NAME
```

Replace `SECRET_NAME` with the actual name of each environment variable (e.g., `UPSTASH_REDIS_REST_URL`).

### 4. Development

To start the development server, run:

```
npm run dev
```

### 5. Deployment

To deploy the project, run:

```
npm run deploy
```
