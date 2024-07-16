import { RAGChat, upstash } from "@upstash/rag-chat";
import { aiUseChatAdapter } from "@upstash/rag-chat/nextjs";
import type { Message } from "ai";

// 👇 allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(request: Request) {
  const { messages } = await request.json();

  const question = (messages as Message[]).at(-1)?.content;
  if (!question) throw new Error("No question in the request");

  const ragChat = new RAGChat({
    model: upstash("meta-llama/Meta-Llama-3-8B-Instruct"),

    // 👇 ALTERNATIVE
    // model: openai("gpt-4-turbo")
  });

  const response = await ragChat.chat(question, { streaming: true });

  return aiUseChatAdapter(response);
}
