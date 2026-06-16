import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // src tests, plus RuleTester coverage for the custom ESLint rules in
    // eslint-rules/ (they run under vitest for the global describe/it).
    include: ["src/**/*.test.{ts,tsx}", "eslint-rules/**/*.test.mjs"],
    // Interaction-heavy tests (userEvent + Radix dialogs) legitimately run at
    // 4-7s in isolation and slower under parallel load. The 5s default ceiling
    // made them intermittent — 15s trades slower hang-detection for a stable suite.
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
    },
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
