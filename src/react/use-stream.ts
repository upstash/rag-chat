"use client";

import { useEffect, useState } from "react";
import type { UpstashMessage } from "../types";
import type { StreamableValue } from "ai/rsc";
import { readStreamableValue } from "ai/rsc";

export type MessageHandlerProps = {
  message: string;
  sessionId?: string;
};

export type MessageGetterProps = {
  sessionId?: string;
};

type UseStreamParameters = {
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
      const history = await historyGetter({ sessionId });
      setMessages(history);
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

      if (isStream) {
        for await (const value of readStreamableValue(output)) {
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
