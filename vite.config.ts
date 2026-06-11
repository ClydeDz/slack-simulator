import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/client",
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
      "@client": path.resolve(__dirname, "src/client"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:4500", changeOrigin: true },
      "/_control": { target: "http://localhost:4500", changeOrigin: true },
      "/_ws": { target: "ws://localhost:4500", ws: true, changeOrigin: true },
      "/config/avatars": {
        target: "http://localhost:4500",
        changeOrigin: true,
      },
    },
  },
});
