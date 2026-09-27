import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    silent: true,
  },
  esbuild: {
    target: "ES2022",
  },
});
