import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const srcPath = fileURLToPath(new URL("./src", import.meta.url));
const apiPath = fileURLToPath(new URL("./convex/_generated/api.js", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": srcPath,
      "convex/_generated/api": apiPath,
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30000,
    exclude: ["node_modules", "dist", "tests/e2e/**/*"],
  },
});
