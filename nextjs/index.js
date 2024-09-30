"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/nextjs/index.ts
var nextjs_exports = {};
__export(nextjs_exports, {
  aiUseChatAdapter: () => aiUseChatAdapter,
  readServerActionStream: () => readServerActionStream
});
module.exports = __toCommonJS(nextjs_exports);

// src/nextjs/chat-adapter.ts
var import_ai = require("ai");
var aiUseChatAdapter = (response, metadata) => {
  const streamData = new import_ai.StreamData();
  const wrappedStream = import_ai.LangChainAdapter.toAIStream(response.output, {
    onStart() {
      if (metadata) {
        streamData.append(metadata);
      }
    },
    onFinal() {
      void streamData.close();
    }
  });
  return new import_ai.StreamingTextResponse(wrappedStream, {}, streamData);
};

// src/nextjs/server-action-read-adapter.ts
var import_rsc = require("ai/rsc");
var readServerActionStream = (stream) => {
  return (0, import_rsc.readStreamableValue)(stream);
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  aiUseChatAdapter,
  readServerActionStream
});
