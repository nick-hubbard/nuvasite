import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/helpers/global-setup.ts"],
    // Tests share one Postgres database, so suites must not interleave.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
