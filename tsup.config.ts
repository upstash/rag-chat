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
  },
  {
    entry: ["./react.ts"],
    outDir: "dist/react",
    format: ["cjs", "esm"],
    sourcemap: false,
    clean: true,
    dts: true,
    minify: false,
  },
  {
    entry: ["src/rsc/rsc-server.ts", "src/rsc/rsc-client.ts"],
    outDir: "dist/rsc",
    format: ["esm"],
    external: ["react"],
    dts: true,
    minify: false,
    sourcemap: true,
  },
  {
    entry: ["src/rsc/index.ts"],
    outDir: "dist/rsc",
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
