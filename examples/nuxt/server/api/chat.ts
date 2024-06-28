import { RAGChat, upstashModel } from "@upstash/rag-chat";
import { aiUseChatAdapter } from "@upstash/rag-chat/nextjs";
import { Index } from "@upstash/vector";
import { Message } from "ai";

export default defineLazyEventHandler(async () => {
  const apiKey = useRuntimeConfig();

  return defineEventHandler(async (event: any) => {
    // Extract the `prompt` from the body of the request
    const { messages } = (await readBody(event)) as {
      messages: any[];
    };
    const question = (messages as Message[]).at(-1)?.content;
    if (!question) throw new Error("No question in the request");

    const ragChat = new RAGChat({
      vector: new Index({
        token: apiKey.UPSTASH_VECTOR_REST_TOKEN,
        url: apiKey.UPSTASH_VECTOR_REST_URL,
      }),
      model: upstashModel("meta-llama/Meta-Llama-3-8B-Instruct", { apiKey: apiKey.QSTASH_TOKEN }),
    });
    //OR
    //   const ragChat = new RAGChat({
    //     model: openaiModel("gpt-4"),
    //   });

    const response = await ragChat.chat(question, { streaming: true });

    return aiUseChatAdapter(response);
  });
});
