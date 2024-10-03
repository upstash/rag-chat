import type { JSONValue } from "ai";
import { LangChainAdapter, StreamData, StreamingTextResponse } from "ai";

/**
 * Converts a ReadableStream response from the chat() function into a StreamingTextResponse
 * suitable for use with the ai-sdk's useChat Next.js hook.
 *
 * @param response - The response object containing:
 *   - output: A ReadableStream of LangChainAIMessageChunk from the chat function.
 *   - isStream: A boolean indicating if the response is a stream.
 * @returns StreamingTextResponse - The adapted response for use with the useChat hook.
 */
export const aiUseChatAdapter = (
  response: { output: ReadableStream<string>; isStream: true },
  metadata?: JSONValue
) => {
  const streamData = new StreamData();

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const wrappedStream = LangChainAdapter.toAIStream(response.output, {
    onStart() {
      if (metadata) {
        streamData.append(metadata);
      }
    },
    onFinal() {
      void streamData.close();
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return new StreamingTextResponse(wrappedStream, {}, streamData);
};
