import { defineConfig } from "tsup";
export default defineConfig([
  {
    entry: ["./index.ts"],
    outDir: "dist/base",
    format: ["cjs", "esm"],
    sourcemap: false,
    clean: true,
    dts: true,
    minify: false,
    external: ["@langchain/anthropic", "@langchain/mistralai", "langsmith"],
  },
  {
    entry: ["src/nextjs/rsc-server.ts", "src/nextjs/rsc-client.ts"],
    outDir: "dist/nextjs",
    format: ["esm"],
    external: ["react"],
    dts: true,
    minify: false,
    sourcemap: true,
  },
  {
    entry: ["src/nextjs/index.ts"],
    outDir: "dist/nextjs",
    dts: true,
    outExtension() {
      return {
        // It must be `.d.ts` instead of `.d.mts` to support node resolution.
        // See https://github.com/vercel/ai/issues/1028.
        dts: ".d.ts",
        js: ".mjs",
      };
    },
  },
]);
