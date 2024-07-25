import { LangChainAdapter, StreamingTextResponse } from "ai";

/**
 * Converts a ReadableStream response from the chat() function into a StreamingTextResponse
 * suitable for use with the ai-sdk's useChat Next.js hook.
 *
 * @param response - The response object containing:
 *   - output: A ReadableStream of LangChainAIMessageChunk from the chat function.
 *   - isStream: A boolean indicating if the response is a stream.
 * @returns StreamingTextResponse - The adapted response for use with the useChat hook.
 */
export const aiUseChatAdapter = (response: { output: ReadableStream<string>; isStream: true }) => {
  const wrappedStream = LangChainAdapter.toAIStream(response.output);
  return new StreamingTextResponse(wrappedStream, {});
};
