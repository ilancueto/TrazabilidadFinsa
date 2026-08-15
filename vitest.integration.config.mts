import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.integration.test.ts", "src/lib/evidence/persist.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
