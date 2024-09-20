import { defineConfig } from "tsup";
export default defineConfig([
  {
    entry: ["./index.ts"],
    outDir: "dist/base",
    format: ["cjs", "esm"],
    clean: true,
    dts: true,
  },
  {
    entry: ["src/nextjs/rsc-server.ts"],
    outDir: "dist/nextjs",
    format: ["esm"],
    clean: true,
    dts: true,
  },
  {
    entry: ["src/nextjs/index.ts"],
    outDir: "dist/nextjs",
    format: ["cjs", "esm"],
    clean: true,
    dts: true,
  },
]);
