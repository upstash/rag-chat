"use client";

import type { Message } from "ai/react";
import { useChat } from "ai/react";
import { useState } from "react";

export default function Page() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: "/api/chat",
    initialInput:
      "What year was the construction of the Eiffel Tower completed, and what is its height?",
  });

  const [loading, setLoading] = useState(false);

  const handleAddData = async () => {
    setLoading(true);
    try {
      await fetch("/api/add-data", { method: "POST" });
    } catch (error) {
      console.error("Error adding data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {messages.map((m: Message) => (
        <div key={m.id} className="whitespace-pre-wrap">
          <strong>{`${m.role}: `}</strong>
          {m.content}
          <br />
          <br />
        </div>
      ))}

      <form onSubmit={handleSubmit} className="relative">
        <input
          className="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl"
          value={input}
          placeholder="Ask something..."
          onChange={handleInputChange}
        />
        <button
          className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full fixed bottom-0 right-5 p-2 mb-8 ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={handleAddData}
          disabled={loading}
          type="button"
        >
          {loading ? "Loading..." : "Add data about France"}
        </button>
      </form>
    </div>
  );
}
