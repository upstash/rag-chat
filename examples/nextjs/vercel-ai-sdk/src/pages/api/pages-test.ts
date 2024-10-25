import { RAGChat } from "@upstash/rag-chat";
import { NextApiRequest, NextApiResponse } from "next";

// This is a test route to check if imports are working with pages router
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const ragChat = new RAGChat({});

  await ragChat.context.add({
    type: "text",
    data: "This is context added from the pages router example",
  });

  res.status(200).json({ message: "OK" });
}
