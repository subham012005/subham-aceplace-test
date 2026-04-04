import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Pick up every *.test.ts anywhere under src/
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", ".next", "dist"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
