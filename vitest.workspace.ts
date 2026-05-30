import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "convex",
      environment: "node",
      globals: true,
      include: [
        "tests/unit/*.test.ts",
        "tests/integration/*.test.ts",
        "tests/convex/**/*.test.ts",
      ],
      exclude: ["tests/unit/use-local-storage.test.ts"],
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "react",
      environment: "jsdom",
      globals: true,
      include: [
        "tests/unit/*.test.tsx",
        "tests/unit/use-local-storage.test.ts",
      ],
      setupFiles: ["./tests/setup.ts"],
    },
  },
]);
