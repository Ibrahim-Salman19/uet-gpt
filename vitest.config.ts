import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "convex/_generated/api": path.resolve(__dirname, "./convex/_generated/api.js"),
    },
  },
});
