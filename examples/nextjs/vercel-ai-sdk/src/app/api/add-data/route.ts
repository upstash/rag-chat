/* eslint-disable @typescript-eslint/no-magic-numbers */
import { RAGChat } from "@upstash/rag-chat";

export async function POST() {
  const ragChat = new RAGChat({});
  await Promise.all([
    ragChat.context.add({
      type: "text",
      data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
    }),
    ragChat.context.add({
      type: "text",
      data: "The city is home to numerous world-class museums, including the Louvre Museum, housing famous works such as the Mona Lisa and Venus de Milo.",
    }),
    ragChat.context.add({
      type: "text",
      data: "Paris is often called the City of Light due to its significant role during the Age of Enlightenment and its early adoption of street lighting.",
    }),
    ragChat.context.add({
      type: "text",
      data: "The Seine River gracefully flows through Paris, dividing the city into the Left Bank and the Right Bank, each offering its own distinct atmosphere.",
    }),
    ragChat.context.add({
      type: "text",
      data: "Paris boasts a rich culinary scene, with a plethora of bistros, cafés, and Michelin-starred restaurants serving exquisite French cuisine.",
    }),
  ]);

  // 👇 slight delay to allow for vector indexing
  await sleep(5000);

  return new Response("OK");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
