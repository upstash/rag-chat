import { RAGChat, upstashModel } from "@upstash/rag-chat";

export const ragChat = new RAGChat({
  model: upstashModel("meta-llama/Meta-Llama-3-8B-Instruct"),
});
