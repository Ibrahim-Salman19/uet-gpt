import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

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
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**", "convex/**"],
      exclude: ["convex/_generated/**", "**/*.d.ts", "**/*.config.*", "tests/**"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});
