import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "convex/_generated/api": path.resolve(import.meta.dirname, "./convex/_generated/api.js"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
