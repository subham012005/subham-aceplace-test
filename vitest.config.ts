import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Pick up tests in the root src/ and in all workspace packages
    include: ["src/**/*.test.ts", "packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
    exclude: ["node_modules", ".next", "dist"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@aceplace/runtime-core": path.resolve(__dirname, "./packages/runtime-core/src"),
    },
  },
});
