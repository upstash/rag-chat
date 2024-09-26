import { Hono } from "hono";
import { Index } from "@upstash/vector";
import { openai, RAGChat, upstash } from "@upstash/rag-chat";

const app = new Hono<{
  Variables: {
    ragChat: RAGChat;
  };
  Bindings: {
    UPSTASH_REDIS_REST_URL: string;
    UPSTASH_REDIS_REST_TOKEN: string;
    UPSTASH_VECTOR_REST_URL: string;
    UPSTASH_VECTOR_REST_TOKEN: string;
    QSTASH_TOKEN: string;
    OPENAI_API_KEY: string;
  };
}>();

app.use("*", async (c, next) => {
  const ragChat = new RAGChat({
    model: upstash("meta-llama/Meta-Llama-3-8B-Instruct", { apiKey: c.env.QSTASH_TOKEN }),

    // 👇 ALTERNATIVE
    // model: openai("gpt-4-turbo", {
    //   apiKey: c.env.OPENAI_API_KEY,
    // }),

    vector: new Index({
      url: c.env.UPSTASH_VECTOR_REST_URL,
      token: c.env.UPSTASH_VECTOR_REST_TOKEN,
      cache: false,
    }),
  });

  c.set("ragChat", ragChat);

  await next();
});

app.get("/", (c) => {
  const landingPage = `
    <html>
      <body>
        <h1>Available Endpoints</h1>
        <ul>
          <li><a href="/add-data">Add Data</a></li>
          <li><a href="/chat">Chat</a></li>
          <li><a href="/chat-stream">Chat Stream</a></li>
        </ul>
      </body>
    </html>
  `;
  return c.html(landingPage);
});

app.get("/add-data", async (c) => {
  const ragChat = c.var.ragChat;

  const result = await Promise.all([
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

  return c.text(`Added data. Result: ${JSON.stringify(result)}`, 200);
});

app.get("/chat", async (c) => {
  const response = await c.var.ragChat.chat("What is paris called?", { streaming: false });

  return c.text(response.output, 200);
});

app.get("/chat-stream", async (c) => {
  const response = await c.var.ragChat.chat(
    "Describe what Paris is known as, narrating in the style of Dostoyevsky, and provide the answer in approximately a thousand words.",
    { streaming: true }
  );

  const textEncoder = new TextEncoder();
  const { readable, writable } = new TransformStream<string>({
    transform(chunk, controller) {
      controller.enqueue(textEncoder.encode(chunk));
    },
  });

  // Start pumping the body. NOTE: No await!
  void response.output.pipeTo(writable);

  // ... and deliver our Response while that’s running.
  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
});

export default app;
