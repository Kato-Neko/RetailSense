// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward everything under /api/* → http://localhost:5000/api/*
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
        // ↓ remove rewrite entirely (or make it a no-op)
        // rewrite: (path) => path,
      },
    },
  },
});
