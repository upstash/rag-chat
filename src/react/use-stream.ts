"use client";

import { useEffect, useState } from "react";
import type { UpstashMessage } from "../types";
import type { StreamableValue } from "ai/rsc";
import { readStreamableValue } from "ai/rsc";
import { serverFn } from "./serverfn";

export type MessageHandlerProps = {
  message: string;
  sessionId?: string;
};

export type MessageGetterProps = {
  sessionId?: string;
};

export type UseStreamParameters = {
  sessionId?: string;
  messageHandler: ({
    message,
  }: MessageHandlerProps) => Promise<{ output: StreamableValue | string; isStream: boolean }>;
  historyGetter: ({ sessionId }: MessageGetterProps) => Promise<UpstashMessage[]>;
};

export const useStream = ({ sessionId, messageHandler, historyGetter }: UseStreamParameters) => {
  const [messages, setMessages] = useState<UpstashMessage[]>([]);
  const [aiResponseStream, setAiResponseStream] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [variables, setVariables] = useState<string>("");

  useEffect(() => {
    const initMessages = async () => {
      try {
        const history = await historyGetter({ sessionId });
        setMessages(history);
      } catch (error) {
        console.error(error);
        setMessages([]);
      }
    };

    initMessages().catch((error: unknown) => {
      console.error(error);
    });
  }, []);

  const submitMessage = async ({ message }: { message: string }) => {
    try {
      setIsGenerating(true);
      setVariables(message);

      const { output, isStream } = await messageHandler({ message, sessionId });

      console.log("output is:", output);

      if (isStream) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        for await (const value of readStreamableValue(output as any)) {
          setAiResponseStream(value as string);
        }
      } else {
        setAiResponseStream(output as string);
      }
    } catch (error) {
      console.error(error);
    } finally {
      const freshMessages = await historyGetter({ sessionId });
      setAiResponseStream("");
      setVariables("");
      setMessages(freshMessages);
      setIsGenerating(false);
    }
  };

  const combinedMessages: UpstashMessage[] = [
    ...(aiResponseStream
      ? [
          {
            role: "assistant" as const,
            content: aiResponseStream,
            id: "",
            metadata: {},
          },
        ]
      : []),
    ...(variables
      ? [
          {
            role: "user" as const,
            content: variables,
            id: "",
            metadata: {},
          },
        ]
      : []),
    ...messages,
  ];

  return { messages: combinedMessages, submitMessage, isGenerating };
};
