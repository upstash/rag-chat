import { HumanMessage, type BaseMessage } from "@langchain/core/messages";
import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { IterableReadableStreamInterface } from "@langchain/core/utils/stream";
import type { ChatOptions, UpstashMessage } from "./types";
import type { ModifiedChatOptions } from "./utils";
import type { ChatLogger } from "./logger";

type ChatReturnType<T extends Partial<ChatOptions>> = Promise<
  T["streaming"] extends true
    ? {
        output: ReadableStream<string>;
        isStream: true;
      }
    : { output: string; isStream: false }
>;
export class LLMService {
  constructor(private model: BaseLanguageModelInterface) {}

  async callLLM<TChatOptions extends ChatOptions>(
    optionsWithDefault: ModifiedChatOptions,
    prompt: string,
    _options: TChatOptions | undefined,
    callbacks: {
      onChunk?: ChatOptions["onChunk"];
      onComplete?: (output: string) => void;
    },
    debug?: ChatLogger
  ) {
    debug?.startLLMResponse();
    return (
      optionsWithDefault.streaming
        ? this.makeStreamingLLMRequest(prompt, callbacks)
        : this.makeLLMRequest(prompt, callbacks.onComplete)
    ) as ChatReturnType<TChatOptions>;
  }

  private async makeStreamingLLMRequest(
    prompt: string,
    {
      onComplete,
      onChunk,
    }: {
      onComplete?: (output: string) => void;
      onChunk?: ChatOptions["onChunk"];
    }
  ) {
    const stream = (await this.model.stream([
      new HumanMessage(prompt),
    ])) as IterableReadableStreamInterface<UpstashMessage>;

    const reader = stream.getReader();
    let concatenatedOutput = "";

    const newStream = new ReadableStream<string>({
      start(controller) {
        const processStream = async () => {
          let done: boolean | undefined;
          let value: UpstashMessage | undefined;

          try {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
            while (true) {
              ({ done, value } = await reader.read());
              if (done) break;

              const message = value?.content ?? "";
              onChunk?.({
                content: message,
                inputTokens: value?.usage_metadata?.input_tokens ?? 0,
                chunkTokens: value?.usage_metadata?.output_tokens ?? 0,
                totalTokens: value?.usage_metadata?.total_tokens ?? 0,
                rawContent: value as unknown as string,
              });
              concatenatedOutput += message;

              controller.enqueue(message);
            }

            controller.close();
            onComplete?.(concatenatedOutput);
          } catch (error) {
            controller.error(error);
          }
        };

        void processStream();
      },
    });

    return { output: newStream, isStream: true };
  }

  private async makeLLMRequest(prompt: string, onComplete?: (output: string) => void) {
    const { content } = (await this.model.invoke(prompt)) as BaseMessage;
    onComplete?.(content as string);
    return { output: content as string, isStream: false };
  }
}
