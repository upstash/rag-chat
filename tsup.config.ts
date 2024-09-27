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
    entry: ["nextjs/rsc-server.ts"],
    outDir: "nextjs/dist",
    format: ["esm"],
    dts: true,
  },
  {
    entry: ["nextjs/index.ts"],
    outDir: "nextjs/dist",
    format: ["cjs", "esm"],
    dts: true,
  },
]);
