import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, proxy the WebSocket + HTTP API (avatars) to FastAPI on :8000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5400,
    proxy: {
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
      },
      "/api": {
        target: "http://localhost:8000",
      },
    },
  },
});
