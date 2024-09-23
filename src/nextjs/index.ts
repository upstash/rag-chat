export * from "./chat-adapter";
export * from "./server-action-read-adapter";

// This cant be exported here because you can't import ai/rsc
// when not using a server component
// Opposite is true for the read adapter, it can't be imported in the rsc-server.ts file
export type * from "./server-action-write-adapter";
