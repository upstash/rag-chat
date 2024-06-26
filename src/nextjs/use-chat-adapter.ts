import { LangChainAdapter, StreamingTextResponse } from "ai";
import type { LangChainAIMessageChunk } from "../types";

/**
 * Converts a ReadableStream response from the chat() function into a StreamingTextResponse
 * suitable for use with the ai-sdk's useChat Next.js hook.
 *
 * @param response - The response object containing:
 *   - output: A ReadableStream of LangChainAIMessageChunk from the chat function.
 *   - isStream: A boolean indicating if the response is a stream.
 * @returns StreamingTextResponse - The adapted response for use with the useChat hook.
 */
export const useChatAdapter = (response: {
  output: ReadableStream<LangChainAIMessageChunk>;
  isStream: boolean;
}) => {
  const wrappedStream = LangChainAdapter.toAIStream(response.output);
  return new StreamingTextResponse(wrappedStream, {});
};
