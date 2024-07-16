import { APIEvent } from "@solidjs/start/server";
import { RAGChat, upstash } from "@upstash/rag-chat";
import { aiUseChatAdapter } from "@upstash/rag-chat/nextjs";
import { Index } from "@upstash/vector";
import { Message } from "ai";

export const POST = async (event: APIEvent) => {
  const { messages } = await event.request.json();

  const question = (messages as Message[]).at(-1)?.content;
  if (!question) throw new Error("No question in the request");

  const ragChat = new RAGChat({
    vector: new Index({
      token: process.env.UPSTASH_VECTOR_REST_TOKEN,
      url: process.env.UPSTASH_VECTOR_REST_URL,
    }),
    model: upstash("meta-llama/Meta-Llama-3-8B-Instruct", {
      apiKey: process.env.QSTASH_TOKEN!,
    }),

    // 👇 ALTERNATIVE
    // model: openai("gpt-4-turbo")
  });

  const response = await ragChat.chat(question, { streaming: true });
  return aiUseChatAdapter(response);
};
