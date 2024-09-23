import { RAGChat, upstash } from "@upstash/rag-chat";
import dotenv from "dotenv";
import { createServer } from "node:http";

// to read vector credentials from .env file
dotenv.config();

const server = createServer(async (_, result) => {
  const ragChat = new RAGChat({
    model: upstash("meta-llama/Meta-Llama-3-8B-Instruct"),

    // 👇 ALTERNATIVE
    // model: openai("gpt-4-turbo")
  });

  await ragChat.context.add({
    type: "text",
    data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
  });

  // 👇 slight delay to allow for vector indexing
  await sleep(3000);

  const response = await ragChat.chat(
    "What year was the construction of the Eiffel Tower completed, and what is its height?"
  );

  result.writeHead(200, { "Content-Type": "text/plain" });
  result.write(response.output);
  result.end();
});

server.listen(8080, () => {
  console.log("Server listening on http://localhost:8080");
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
