import { defineConfig } from "vite";
export default defineConfig({
  base: process.env.SITE_BASE_PATH || "/vardhanproject/",
  optimizeDeps: { entries: ["index.html"] },
  server: { proxy: { "/api": "http://127.0.0.1:8791" } },
  build: { target: "es2022" },
});
