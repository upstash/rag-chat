import { RAGChat, upstash } from "@upstash/rag-chat";
import { aiUseChatAdapter } from "@upstash/rag-chat/nextjs";
import { Index } from "@upstash/vector";
import type { Message } from "@ai-sdk/vue";

export default defineLazyEventHandler(() => {
  const apiKey = useRuntimeConfig();

  return defineEventHandler(async (event) => {
    // Extract the `prompt` from the body of the request
    const { messages } = await readBody<{
      messages: Message[];
    }>(event);

    const question = messages.at(-1)?.content;
    if (!question) throw new Error("No question in the request");

    const ragChat = new RAGChat({
      vector: new Index({
        token: apiKey.UPSTASH_VECTOR_REST_TOKEN,
        url: apiKey.UPSTASH_VECTOR_REST_URL,
      }),
      model: upstash("meta-llama/Meta-Llama-3-8B-Instruct", { apiKey: apiKey.QSTASH_TOKEN }),

      // 👇 ALTERNATIVE
      // model: openai("gpt-4"),
    });

    const response = await ragChat.chat(question, { streaming: true });

    return aiUseChatAdapter(response);
  });
});
