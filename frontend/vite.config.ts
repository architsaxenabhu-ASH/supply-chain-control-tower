import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The dev server proxies API calls to the local FastAPI backend. This lets a
// SINGLE shared tunnel (the frontend on :5173) carry the backend too: a remote
// viewer's `/api/...` request travels tunnel → this dev server → backend, so
// everyone — including a manager in another city — drives and sees the SAME
// live demo counters (no second tunnel, no cross-origin setup). Start the dev
// server with VITE_API_BASE_URL=/api/v1 so the app uses these relative paths.
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/health": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
});
