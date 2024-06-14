import type { BaseMessage, StoredMessage } from "@langchain/core/messages";
import type { UpstashDict, UpstashMessage } from "../types";
import { nanoid } from "nanoid";

export const mapLangchainMessageToUpstashMessages = <TMetadata extends UpstashDict = UpstashDict>(
  messages: (StoredMessage | BaseMessage)[]
): UpstashMessage<TMetadata>[] => {
  return messages.map((message) => {
    const _message = "data" in message ? message : message.toDict();
    return {
      role: _message.type === "ai" ? "assistant" : "user",
      content: _message.data.content,
      metadata: _message.data.response_metadata as TMetadata,
      id: nanoid(),
    };
  });
};
