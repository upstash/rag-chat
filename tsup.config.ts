import { defineConfig } from "tsup";
export default defineConfig([
  {
    entry: ["src/index.ts"],
    outDir: "dist",
    format: ["cjs", "esm"],
    clean: true,
    dts: true,
  },
  {
    entry: ["src/nextjs/rsc-server.ts"],
    outDir: "dist/nextjs",
    format: ["esm"],
    dts: true,
  },
  {
    entry: ["src/nextjs/index.ts"],
    outDir: "dist/nextjs",
    format: ["cjs", "esm"],
    dts: true,
  },
]);
