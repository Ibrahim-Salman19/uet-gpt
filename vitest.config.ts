import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30000,
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**", "dist"],
    // Use child-process forks instead of worker threads. Worker threads
    // deadlock on startup in this WSL2 environment; forks do not.
    // Run at most 3 files concurrently to avoid resource exhaustion when
    // DOM-environment tests (.tsx) are included.
    pool: "forks",
    maxWorkers: 3,
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.js"),
      "convex/_generated/api": path.resolve(__dirname, "./convex/_generated/api"),
      "convex/_generated/server": path.resolve(__dirname, "./convex/_generated/server"),
      "convex/_generated/dataModel": path.resolve(__dirname, "./convex/_generated/dataModel"),
    },
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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
