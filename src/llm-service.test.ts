import { describe, test, expect, mock, beforeEach } from "bun:test";
import { LLMService } from "./llm-service";
import { ChatLogger } from "./logger";
import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { OpenAIChatLanguageModel, PromptParameters, ToolingOptions } from ".";

// Common test utilities and fixtures
const createBaseMockModel = () => ({
  callKeys: [],
  generatePrompt: mock(() => Promise.resolve()),
  predict: mock(() => Promise.resolve("")),
  predictMessages: mock(() => Promise.resolve("")),
  call: mock(() => Promise.resolve("")),
  pipe: mock(() => Promise.resolve("")),
  batch: mock(() => Promise.resolve([])),
  generate: mock(() => Promise.resolve({ generations: [] })),
  _modelType: () => "base",
  _llmType: () => "base",
  getNumTokens: mock(() => Promise.resolve(0)),
  _identifyingParams: () => ({}),
  serialize: () => ({}),
  lc_serializable: true,
  lc_kwargs: {},
  lc_namespace: ["test"],
  lc_aliases: {},
});

const createDefaultOptions = (isStreaming: boolean) => ({
  streaming: isStreaming,
  sessionId: "test-session",
  disableRAG: false,
  disableHistory: false,
  ratelimitSessionId: "",
  similarityThreshold: 0.8,
  toolingOptions: {
    tools: {},
    maxSteps: 5,
    toolChoice: "auto",
  } as ToolingOptions,
  topK: 0,
  historyLength: 0,
  historyTTL: 0,
  namespace: "",
  promptFn: function ({ question, chatHistory, context }: PromptParameters): string {
    return `Question: ${question}\nHistory: ${chatHistory}\nContext: ${context}`;
  },
});

const toolingOptions = {
  tools: {
    calculator: {
      parameters: {
        properties: {
          operation: { type: "string", enum: ["add", "subtract"] },
          a: { type: "number" },
          b: { type: "number" },
        },
        required: ["operation", "a", "b"],
      },
      type: "function",
      description: "A calculator function",
    },
  },
  maxSteps: 3,
  toolChoice: "auto",
} as const;

const onChunkMock = mock(() => {
  /** no empty function */
});
const onCompleteMock = mock(() => {
  /** no empty function */
});

describe("LLMService", () => {
  let llmService: LLMService;
  let mockModel: BaseLanguageModelInterface | OpenAIChatLanguageModel;
  let mockLogger: ChatLogger;

  beforeEach(() => {
    mockModel = {
      ...createBaseMockModel(),
      stream: mock(() => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue({
              content: "Hello",
              usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
            });
            controller.close();
          },
        });
        return Promise.resolve(stream);
      }),
      invoke: mock(() => Promise.resolve({ content: "Hello" })),
    } as unknown as BaseLanguageModelInterface;
    mockLogger = new ChatLogger({ logLevel: "INFO", logOutput: "console" });
    llmService = new LLMService(mockModel);
  });

  describe("streaming mode", () => {
    test("should handle streaming response correctly", async () => {
      const result = await llmService.callLLM(
        createDefaultOptions(true),
        undefined,
        {
          onChunk: onChunkMock,
          onComplete: onCompleteMock,
        },
        mockLogger
      )("Test prompt");

      expect(result.isStream).toBeTruthy();
      expect(result.output).toBeInstanceOf(ReadableStream);

      const stream = result.output as unknown as ReadableStream<string>;
      const reader = stream.getReader();
      const { value, done } = (await reader.read()) as { value: string; done: boolean };

      expect(value).toBe("Hello");
      expect(done).toBe(false);

      expect(onChunkMock).toHaveBeenCalledWith({
        content: "Hello",
        inputTokens: 10,
        chunkTokens: 5,
        totalTokens: 15,
        rawContent: {
          content: "Hello",
          usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
        },
      });
    });

    test("should handle OpenAI streaming model correctly", async () => {
      const openAIModel = {
        modelName: "gpt-4",
        apiKey: "test-key",
        streamText: true,
        stream: mock(() => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue({
                content: "Hello from OpenAI stream",
                usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
              });
              controller.close();
            },
          });
          return Promise.resolve(stream);
        }),
      } as unknown as BaseLanguageModelInterface;

      const streamingService = new LLMService(openAIModel);

      const result = await streamingService.callLLM(
        createDefaultOptions(true),
        undefined,
        { onChunk: onChunkMock },
        mockLogger
      )("Test prompt");

      expect(result.isStream).toBeTruthy();
      expect(result.output).toBeInstanceOf(ReadableStream);
    });
  });

  describe("non-streaming mode", () => {
    test("should handle non-streaming response correctly", async () => {
      const result = await llmService.callLLM(
        createDefaultOptions(false),
        undefined,
        { onComplete: onCompleteMock },
        mockLogger
      )("Test prompt");

      expect(result.isStream).toBe(false);
      expect(result.output).toBe("Hello");
      expect(onCompleteMock).toHaveBeenCalledWith("Hello");
    });

    test("should handle OpenAI non-streaming model correctly", async () => {
      const openAIModel = {
        modelName: "gpt-4",
        apiKey: "test-key",
        invoke: mock(() => Promise.resolve({ content: "Hello from OpenAI" })),
        generateText: mock(() => Promise.resolve({ text: "Hello from OpenAI" })),
      };

      const nonStreamingService = new LLMService(
        openAIModel as unknown as BaseLanguageModelInterface
      );

      const result = await nonStreamingService.callLLM(
        createDefaultOptions(false),
        undefined,
        { onComplete: onCompleteMock },
        mockLogger
      )("Test prompt");

      expect(result.isStream).toBeFalsy();
      expect(result.output).toBe("Hello from OpenAI");
      expect(onCompleteMock).toHaveBeenCalledWith("Hello from OpenAI");
    });

    test("should handle non-streaming errors correctly", async () => {
      const errorModel = {
        ...createBaseMockModel(),
        invoke: mock(() => Promise.reject(new Error("Model error"))),
      } as unknown as BaseLanguageModelInterface;

      const errorService = new LLMService(errorModel);

      let error;
      try {
        await errorService.callLLM(
          createDefaultOptions(false),
          undefined,
          { onComplete: onCompleteMock },
          mockLogger
        )("Test prompt");
      } catch (error_) {
        error = error_;
      }

      expect(error).toBeDefined();
      expect((error as Error).message).toBe("Model error");
    });
  });

  describe("error handling", () => {
    test("should handle stream errors correctly", async () => {
      const errorModel = {
        ...createBaseMockModel(),
        stream: mock(() => {
          const stream = new ReadableStream({
            start(controller) {
              controller.error(new Error("Stream error"));
            },
          });
          return Promise.resolve(stream);
        }),
        invoke: mock(() => Promise.resolve({ content: "" })),
      } as unknown as BaseLanguageModelInterface;

      const errorService = new LLMService(errorModel);

      const result = await errorService.callLLM(
        createDefaultOptions(true),
        undefined,
        {
          onChunk: onChunkMock,
          onComplete: onCompleteMock,
        },
        mockLogger
      )("Test prompt");

      expect(result.isStream).toBeTruthy();
      expect(result.output).toBeInstanceOf(ReadableStream);

      const reader = (result.output as unknown as ReadableStream).getReader();
      expect(reader.read()).rejects.toThrow("Stream error");
    });

    test("should handle non-streaming errors correctly", async () => {
      const errorModel = {
        ...createBaseMockModel(),
        invoke: mock(() => Promise.reject(new Error("Model error"))),
      } as unknown as BaseLanguageModelInterface;

      const errorService = new LLMService(errorModel);

      try {
        await errorService.callLLM(
          createDefaultOptions(false),
          undefined,
          { onComplete: onCompleteMock },
          mockLogger
        )("Test prompt");

        expect(false).toBe(true); // Fail test if no error thrown
      } catch (error) {
        expect((error as Error).message).toBe("Model error");
      }
    });
  });

  describe("tooling options", () => {
    describe("streaming mode with tools", () => {
      test("should pass tooling options to streaming model", async () => {
        const model = {
          ...createBaseMockModel(),
          stream: mock(() => {
            const stream = new ReadableStream({
              start(controller) {
                controller.enqueue({
                  content: "Hello with tools",
                  usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
                });
                controller.close();
              },
            });
            return Promise.resolve(stream);
          }),
          invoke: mock(() => Promise.resolve({ content: "Hello with tools" })),
        } as unknown as BaseLanguageModelInterface;

        const service = new LLMService(model);

        const options = {
          ...createDefaultOptions(true),
          toolingOptions,
        };

        const result = await service.callLLM(
          options,
          undefined,
          {
            onChunk: onChunkMock,
            onComplete: onCompleteMock,
          },
          mockLogger
        )("Test prompt");

        expect(result.isStream).toBeTruthy();
        expect(result.output).toBeInstanceOf(ReadableStream);

        const stream = result.output as unknown as ReadableStream<string>;
        const reader = stream.getReader();
        const { value, done } = (await reader.read()) as { value: string; done: boolean };

        expect(value).toBe("Hello with tools");
        expect(done).toBe(false);
        expect(onChunkMock).toHaveBeenCalledWith({
          content: "Hello with tools",
          inputTokens: 10,
          chunkTokens: 5,
          totalTokens: 15,
          rawContent: {
            content: "Hello with tools",
            usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
          },
        });
      });

      test("should use specific tool choice in streaming mode", async () => {
        const model = {
          ...createBaseMockModel(),
          stream: mock(() => {
            const stream = new ReadableStream({
              start(controller) {
                controller.enqueue({
                  content: "Hello with calculator",
                  usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
                });
                controller.close();
              },
            });
            return Promise.resolve(stream);
          }),
          invoke: mock(() => Promise.resolve({ content: "Hello with calculator" })),
        } as unknown as BaseLanguageModelInterface;

        const service = new LLMService(model);

        const options = {
          ...createDefaultOptions(true),
          toolingOptions: {
            ...toolingOptions,
            toolChoice: { type: "tool" as const, toolName: "calculator" },
          },
        };

        const result = await service.callLLM(
          options,
          undefined,
          {
            onChunk: onChunkMock,
            onComplete: onCompleteMock,
          },
          mockLogger
        )("Test prompt");

        expect(result.isStream).toBeTruthy();
        expect(result.output).toBeInstanceOf(ReadableStream);

        const stream = result.output as unknown as ReadableStream<string>;
        const reader = stream.getReader();
        const { value, done } = (await reader.read()) as { value: string; done: boolean };

        expect(value).toBe("Hello with calculator");
        expect(done).toBe(false);
      });
    });

    describe("non-streaming mode with tools", () => {
      test("should pass tooling options to non-streaming model", async () => {
        const model = {
          ...createBaseMockModel(),
          invoke: mock(() => Promise.resolve({ content: "Hello with tools" })),
        } as unknown as BaseLanguageModelInterface;

        const service = new LLMService(model);

        const options = {
          ...createDefaultOptions(false),
          toolingOptions,
        };

        const result = await service.callLLM(
          options,
          undefined,
          { onComplete: onCompleteMock },
          mockLogger
        )("Test prompt");

        expect(result.isStream).toBe(false);
        expect(result.output).toBe("Hello with tools");
        expect(onCompleteMock).toHaveBeenCalledWith("Hello with tools");
      });

      test("should handle tool execution results", async () => {
        const model = {
          ...createBaseMockModel(),
          invoke: mock(() => Promise.resolve({ content: "2 + 2 = 4" })),
        } as unknown as BaseLanguageModelInterface;

        const service = new LLMService(model);

        const options = {
          ...createDefaultOptions(false),
          toolingOptions,
        };

        const result = await service.callLLM(
          options,
          undefined,
          { onComplete: onCompleteMock },
          mockLogger
        )("What is 2 + 2?");

        expect(result.isStream).toBe(false);
        expect(result.output).toBe("2 + 2 = 4");
        expect(onCompleteMock).toHaveBeenCalledWith("2 + 2 = 4");
      });

      test("should respect maxSteps limit", async () => {
        const model = {
          ...createBaseMockModel(),
          invoke: mock(() => Promise.resolve({ content: "Reached max steps" })),
        } as unknown as BaseLanguageModelInterface;

        const service = new LLMService(model);

        const options = {
          ...createDefaultOptions(false),
          toolingOptions: {
            ...toolingOptions,
            maxSteps: 1,
          },
        };

        const result = await service.callLLM(
          options,
          undefined,
          { onComplete: onCompleteMock },
          mockLogger
        )("Test prompt");

        expect(result.isStream).toBe(false);
        expect(result.output).toBe("Reached max steps");
        expect(onCompleteMock).toHaveBeenCalledWith("Reached max steps");
      });
    });
  });
});
