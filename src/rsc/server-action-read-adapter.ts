import { type StreamableValue, readStreamableValue } from "ai/rsc";

export const readServerActionStream = (stream: StreamableValue<string>) => {
  return readStreamableValue(stream);
};
