import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "tools/hanatour-extractor-extension/src/**/*.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "~lib": path.resolve(__dirname, "./tools/hanatour-extractor-extension/src/lib"),
      "~types": path.resolve(__dirname, "./tools/hanatour-extractor-extension/src/types"),
    },
  },
});
