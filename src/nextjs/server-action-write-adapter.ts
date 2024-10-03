/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { type StreamableValue, createStreamableValue } from "ai/rsc";

export const createServerActionStream = (
  stream: ReadableStream<string>
): StreamableValue<string> => {
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
