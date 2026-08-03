import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, proxy the WebSocket + HTTP API (avatars) to FastAPI on :8000.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // React en de iconen in hun eigen brok: die veranderen vrijwel nooit,
        // dus na een release hoeft de telefoon alleen de app-code opnieuw te
        // halen in plaats van alles in één bundel van 750KB.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (id.includes("lucide-react")) return "icons";
          return "vendor";
        },
      },
    },
  },
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
      // Kaart-art van Ontdekken. In productie serveert FastAPI dit pad zelf;
      // in dev moet Vite het doorsturen, anders zoekt hij het in public/.
      "/static": {
        target: "http://localhost:8000",
      },
    },
  },
});
