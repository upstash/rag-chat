# RAGChat with Next.js Example

This project demonstrates how to implement RAGChat (Retrieval-Augmented Generation Chat) using Next.js route handlers. For PDF Based FAQ Bot, we use the Vercel AI-SDK to manage chat messages and interactions. This is fully optional and simplifies our example.

## Getting started

### 1. Install packages

```bash
bun install
```

### 2. Start the app

```bash
bun run dev
```

The app will start running on `http://localhost:3000`.

### How It Works

1. Server actions: The server actions for adding data as well as chatting are located in `actions.ts`:

   - `server_chat`: Handles chat requests, retrieves relevant information using RAG, and streams responses back to the client.
   - `server_add_data`: Adds new data to the knowledge base for future retrieval.

2. RAG Implementation: The RAGChat class from @upstash/rag-chat is used to integrate the vector database and language model.
3. Vector Database: Upstash Vector is used to store and retrieve context-relevant information.
4. Language Model: The example uses Meta's Llama 3 8B Instruct model via QStash, but can be easily switched to OpenAI's GPT models.

### Customization

Upstash RAGChat is highly customizable to suit your needs. For all available options, please refer to our RAGChat documentation.
