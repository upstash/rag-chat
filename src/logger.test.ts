import { describe, expect, setSystemTime, test } from "bun:test";
import { ChatLogger } from "./logger";

describe("LOGGER", () => {
  test("should return all the logs", async () => {
    const date = new Date("1999-01-01T00:00:00.000Z");
    setSystemTime(date); // it's now January 1, 1999
    // Example usage:
    const logger = new ChatLogger({
      logLevel: "DEBUG",
      logOutput: "console",
    });

    await logger.logSendPrompt("What is the weather today?");
    await logger.endRetrieveHistory(["Hello, how are you?", "I'm good, thank you!"]);
    await logger.endRetrieveContext({ relevantData: "Sample context from vector DB" });
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    await logger.endLLMResponse({ response: "The weather today is sunny." });

    expect(logger.getLogs()).toEqual([
      {
        timestamp: Date.now(),
        logLevel: "INFO",
        eventType: "SEND_PROMPT",
        details: {
          prompt: "What is the weather today?",
        },
        latency: undefined,
      },
      {
        timestamp: Date.now(),
        logLevel: "INFO",
        eventType: "RETRIEVE_HISTORY",
        details: {
          history: ["Hello, how are you?", "I'm good, thank you!"],
        },
        latency: undefined,
      },
      {
        timestamp: Date.now(),
        logLevel: "INFO",
        eventType: "RETRIEVE_CONTEXT",
        details: {
          context: {
            relevantData: "Sample context from vector DB",
          },
        },
        latency: undefined,
      },
      {
        timestamp: Date.now(),
        logLevel: "INFO",
        eventType: "LLM_RESPONSE",
        details: {
          response: {
            response: "The weather today is sunny.",
          },
        },
      },
    ]);

    setSystemTime(); // reset to actual time
  });
});
