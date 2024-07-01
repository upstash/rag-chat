import { RAGChat, upstashModel } from "@upstash/rag-chat";
import { streamToResponse } from "ai";
import dotenv from "dotenv";
import { createServer } from "http";

// to read vector credentials from .env file
dotenv.config();

const server = createServer(async (req, res) => {
  const ragChat = new RAGChat({
    model: upstashModel("meta-llama/Meta-Llama-3-8B-Instruct"),

    // 👇 ALTERNATIVE
    // model: openaiModel("gpt-4-turbo")
  });

  await ragChat.context.add({
    dataType: "text",
    data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
  });

  // 👇 slight delay to allow for vector indexing
  await sleep(3000);

  const response = await ragChat.chat(
    "What year was the construction of the Eiffel Tower completed, and what is its height?",
    { streaming: true }
  );

  streamToResponse(response.output, res, {});
});

server.listen(8080);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
