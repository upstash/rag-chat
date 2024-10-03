// src/nextjs/server-action-write-adapter.ts
import { createStreamableValue } from "ai/rsc";
var createServerActionStream = (stream) => {
  const streamableValue = createStreamableValue("");
  const reader = stream.getReader();
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (typeof value === "string") {
          streamableValue.update(value);
        }
      }
      streamableValue.done();
    } catch (error) {
      console.error("Error while reading stream:", error);
      streamableValue.error("An error occurred while processing the stream");
    }
  })();
  return streamableValue.value;
};

// src/nextjs/chat-adapter.ts
import { LangChainAdapter, StreamData, StreamingTextResponse } from "ai";
var aiUseChatAdapter = (response, metadata) => {
  const streamData = new StreamData();
  const wrappedStream = LangChainAdapter.toAIStream(response.output, {
    onStart() {
      if (metadata) {
        streamData.append(metadata);
      }
    },
    onFinal() {
      void streamData.close();
    }
  });
  return new StreamingTextResponse(wrappedStream, {}, streamData);
};
export {
  aiUseChatAdapter,
  createServerActionStream
};
