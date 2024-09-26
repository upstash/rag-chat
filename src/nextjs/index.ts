export * from "./chat-adapter";
export * from "./server-action-read-adapter";

/*
The reason we put export this in the rsc-server.ts file is because we can't import "ai/rsc" here.
In ai/rsc, it has an export field like this

"./rsc": {
  "types": "./rsc/dist/index.d.ts",
  "react-server": "./rsc/dist/rsc-server.mjs",
  "import": "./rsc/dist/rsc-client.mjs"
},

Which means some of the functions in rsc-server.mjs can only be used when
the used import key is "react-server". Or else we get this error
> Attempted import error: 'createStreamableValue' is not exported from 'ai/rsc'
*/
export type * from "./server-action-write-adapter";
