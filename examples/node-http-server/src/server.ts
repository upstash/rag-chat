import { RAGChat, upstashModel } from "@upstash/rag-chat";
import { Index } from "@upstash/vector";
import { streamToResponse } from "ai";
import dotenv from "dotenv";
import { createServer } from "http";

dotenv.config();

createServer(async (req, res) => {
  const ragChat = new RAGChat({
    vector: new Index({
      token: process.env.UPSTASH_VECTOR_REST_TOKEN,
      url: process.env.UPSTASH_VECTOR_REST_URL,
    }),
    model: upstashModel("meta-llama/Meta-Llama-3-8B-Instruct", {
      apiKey: process.env.QSTASH_TOKEN!,
    }),

    // 👇 ALTERNATIVE
    // model: openaiModel("gpt-4-turbo")
  });

  await ragChat.context.add({
    dataType: "text",
    data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
  });
  // 👇 slight delay to allow for vector indexing
  await sleep(10000);

  const response = await ragChat.chat(
    "What year was the construction of the Eiffel Tower completed, and what is its height?",
    { streaming: true }
  );
  streamToResponse(response.output, res, {});
}).listen(8080);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
