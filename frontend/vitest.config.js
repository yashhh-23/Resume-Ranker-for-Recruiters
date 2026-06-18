import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",           // pure util tests don't need jsdom
    include: ["tests/**/*.test.js"],
    globals: false,
  },
});
