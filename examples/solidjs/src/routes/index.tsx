import { createSignal } from "solid-js";
import { For } from "solid-js";
import { useChat } from "@ai-sdk/solid";

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();
  const [loading, setLoading] = createSignal(false);

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
    <div class="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      <For each={messages()}>
        {(m) => (
          <div class="whitespace-pre-wrap">
            {m.role === "user" ? "User: " : "AI: "}
            {m.content}
          </div>
        )}
      </For>

      <form onSubmit={handleSubmit}>
        <input
          class="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl"
          value={input()}
          placeholder="Say something..."
          onChange={handleInputChange}
        />
      </form>

      <button
        class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full fixed bottom-0 right-5 p-2 mb-8"
        onClick={handleAddData}
        disabled={loading()}
      >
        {loading() ? "Loading..." : "Add some data about France"}
      </button>
    </div>
  );
}
