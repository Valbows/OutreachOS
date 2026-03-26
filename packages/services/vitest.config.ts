import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    alias: {
      "@outreachos/db": path.resolve(__dirname, "src/__mocks__/db.ts"),
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/__mocks__/**", "dist/**"],
    },
  },
});
