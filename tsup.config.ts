import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./index.ts", "./react.ts"],
  format: ["cjs", "esm"],
  sourcemap: false,
  clean: true,
  dts: true,
  minify: false,
});
