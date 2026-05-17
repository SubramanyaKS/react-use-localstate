import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: false, // Turn off tsup's internal crashing worker
  sourcemap: true,
  clean: true,
  external: ["react"]
});