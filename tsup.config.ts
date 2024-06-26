import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./index.ts", "./react.ts", "./nextjs"],
  format: ["cjs", "esm"],
  sourcemap: false,
  clean: true,
  dts: true,
  minify: false,
});
