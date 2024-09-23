"use client";

import type { UpstashMessage } from "@upstash/rag-chat";
import { readServerActionStream } from "@upstash/rag-chat/nextjs";
import { useState } from "react";
import { serverAddData, serverChat } from "../actions";

export const Chat = ({ initialMessages }: { initialMessages?: UpstashMessage[] }) => {
  const [messages, setMessages] = useState<UpstashMessage[]>(initialMessages ?? []);
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;

    const userMessage: UpstashMessage = { content: input, role: "user", id: Date.now().toString() };
    setMessages((previous) => [...previous, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const stream = await serverChat({ userMessage });
      const aiMessage: UpstashMessage = {
        content: "",
        role: "assistant",
        id: (Date.now() + 1).toString(),
      };
      setMessages((previous) => [...previous, aiMessage]);

      for await (const chunk of readServerActionStream(stream)) {
        if (!chunk) continue;
        aiMessage.content += chunk;
        setMessages((previous) =>
          previous.map((message) =>
            message.id === aiMessage.id ? { ...message, content: aiMessage.content } : message
          )
        );
      }
    } catch (error) {
      console.error("Error in AI response:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddData = async () => {
    setIsLoading(true);
    try {
      await serverAddData();
    } catch (error) {
      console.error("Error adding data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {messages.map((m) => (
        <div key={m.id} className="whitespace-pre-wrap mb-4">
          <strong>{`${m.role}: `}</strong>
          {m.content}
        </div>
      ))}

      <form onSubmit={handleSubmit} className="fixed bottom-0 w-full max-w-md mb-8 flex">
        <input
          className="flex-grow p-2 border border-gray-300 rounded-l shadow-xl"
          value={input}
          placeholder="Ask something..."
          onChange={(event) => {
            setInput(event.target.value);
          }}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-r"
          disabled={isLoading}
        >
          Send
        </button>
      </form>

      <button
        className={`bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-full fixed bottom-20 right-5 ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={handleAddData}
        disabled={isLoading}
        type="button"
      >
        {isLoading ? "Loading..." : "Add data about France"}
      </button>
    </div>
  );
};
