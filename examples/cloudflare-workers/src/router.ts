import { Hono } from "hono";
import { Index } from "@upstash/vector";
import { RAGChat, openai, upstash } from "@upstash/rag-chat";

type Bindings = {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  UPSTASH_VECTOR_REST_URL: string;
  UPSTASH_VECTOR_REST_TOKEN: string;
  QSTASH_TOKEN: string;
  OPENAI_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  const landingPage = `
    <html>
      <body>
        <h1>Available Endpoints</h1>
        <ul>
          <li><a href="/add-data">Add Data</a></li>
          <li><a href="/chat">Chat</a></li>
          <li><a href="/chat-stream">Chat Stream (Upstash)</a></li>
          <li><a href="/chat-stream-openai">Chat Stream (Open AI)</a></li>
        </ul>
      </body>
    </html>
  `;
  return c.html(landingPage);
});

app.get("/add-data", async (c) => {
  const environment = c.env;
  const ragChat = new RAGChat({
    model: upstash("meta-llama/Meta-Llama-3-8B-Instruct", { apiKey: environment.QSTASH_TOKEN }),
    vector: new Index({
      url: environment.UPSTASH_VECTOR_REST_URL,
      token: environment.UPSTASH_VECTOR_REST_TOKEN,
      cache: false,
    }),
  });

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

  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  return c.text(`Added data. Result: ${JSON.stringify(result)}`, 200);
});

app.get("/chat", async (c) => {
  const environment = c.env;
  const ragChat = new RAGChat({
    model: upstash("meta-llama/Meta-Llama-3-8B-Instruct", { apiKey: environment.QSTASH_TOKEN }),
    vector: new Index({
      url: environment.UPSTASH_VECTOR_REST_URL,
      token: environment.UPSTASH_VECTOR_REST_TOKEN,
      cache: false,
    }),
  });
  const response = await ragChat.chat("What is paris called?", { streaming: false });

  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  return c.text(response.output, 200);
});

app.get("/chat-stream", async (c) => {
  const environment = c.env;
  const ragChat = new RAGChat({
    model: upstash("meta-llama/Meta-Llama-3-8B-Instruct", { apiKey: environment.QSTASH_TOKEN }),
    vector: new Index({
      url: environment.UPSTASH_VECTOR_REST_URL,
      token: environment.UPSTASH_VECTOR_REST_TOKEN,
      cache: false,
    }),
  });
  const response = await ragChat.chat(
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

app.get("/chat-stream-openai", async (c) => {
  const environment = c.env;
  const ragChat = new RAGChat({
    model: openai("gpt-4-turbo", { apiKey: environment.OPENAI_API_KEY }),
    vector: new Index({
      url: environment.UPSTASH_VECTOR_REST_URL,
      token: environment.UPSTASH_VECTOR_REST_TOKEN,
      cache: false,
    }),
  });
  const response = await ragChat.chat(
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
