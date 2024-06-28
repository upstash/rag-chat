import { RAGChat, upstashModel } from "@upstash/rag-chat";
import { aiUseChatAdapter } from "@upstash/rag-chat/nextjs";
import { Index } from "@upstash/vector";
import { Message } from "ai";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export default defineLazyEventHandler(async () => {
  const apiKey = useRuntimeConfig();

  const ragChat = new RAGChat({
    vector: new Index({
      token: apiKey.UPSTASH_VECTOR_REST_TOKEN,
      url: apiKey.UPSTASH_VECTOR_REST_URL,
    }),
    model: upstashModel("meta-llama/Meta-Llama-3-8B-Instruct", { apiKey: apiKey.QSTASH_TOKEN }),
  });

  return defineEventHandler(async (event: any) => {
    await Promise.all([
      ragChat.context.add({
        dataType: "text",
        data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
      }),
      ragChat.context.add({
        dataType: "text",
        data: "The city is home to numerous world-class museums, including the Louvre Museum, housing famous works such as the Mona Lisa and Venus de Milo.",
      }),
      ragChat.context.add({
        dataType: "text",
        data: "Paris is often called the City of Light due to its significant role during the Age of Enlightenment and its early adoption of street lighting.",
      }),
      ragChat.context.add({
        dataType: "text",
        data: "The Seine River gracefully flows through Paris, dividing the city into the Left Bank and the Right Bank, each offering its own distinct atmosphere.",
      }),
      ragChat.context.add({
        dataType: "text",
        data: "Paris boasts a rich culinary scene, with a plethora of bistros, cafés, and Michelin-starred restaurants serving exquisite French cuisine.",
      }),
    ]);
    //Make sure datas are indexed properly
    await sleep(10);

    return new Response("OK");
  });
});
