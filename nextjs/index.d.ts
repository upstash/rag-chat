import { JSONValue, StreamingTextResponse } from 'ai';
import { StreamableValue } from 'ai/rsc';

/**
 * Converts a ReadableStream response from the chat() function into a StreamingTextResponse
 * suitable for use with the ai-sdk's useChat Next.js hook.
 *
 * @param response - The response object containing:
 *   - output: A ReadableStream of LangChainAIMessageChunk from the chat function.
 *   - isStream: A boolean indicating if the response is a stream.
 * @returns StreamingTextResponse - The adapted response for use with the useChat hook.
 */
declare const aiUseChatAdapter: (response: {
    output: ReadableStream<string>;
    isStream: true;
}, metadata?: JSONValue) => StreamingTextResponse;

declare const readServerActionStream: (stream: StreamableValue<string>) => AsyncIterable<string | undefined>;

declare const createServerActionStream: (stream: ReadableStream<string>) => StreamableValue<string>;

export { aiUseChatAdapter, createServerActionStream, readServerActionStream };
