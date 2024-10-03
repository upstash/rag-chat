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

// src/nextjs/server-action-read-adapter.ts
import { readStreamableValue } from "ai/rsc";
var readServerActionStream = (stream) => {
  return readStreamableValue(stream);
};
export {
  aiUseChatAdapter,
  readServerActionStream
};
