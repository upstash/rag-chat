import { env } from "$env/dynamic/private";
import type { Message } from "@ai-sdk/svelte";
import { RAGChat, upstash } from "@upstash/rag-chat";
import { aiUseChatAdapter } from "@upstash/rag-chat/nextjs";
import { Index } from "@upstash/vector";
import type { RequestHandler } from "./$types";

export const POST = (async ({ request }) => {
  const { messages } = (await request.json()) as {
    messages: Message[];
  };

  const question = messages.at(-1)?.content;
  if (!question) throw new Error("No question in the request");

  const ragChat = new RAGChat({
    vector: new Index({ token: env.UPSTASH_VECTOR_REST_TOKEN, url: env.UPSTASH_VECTOR_REST_URL }),
    model: upstash("meta-llama/Meta-Llama-3-8B-Instruct", { apiKey: env.QSTASH_TOKEN }),

    // 👇 ALTERNATIVE
    // model: openai("gpt-4-turbo")
  });

  const response = await ragChat.chat(question, { streaming: true });

  return aiUseChatAdapter(response);
}) satisfies RequestHandler;
