import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Waar de FastAPI-kant draait. Standaard 8000, maar instelbaar met PENNEER_API
// zodat er twee sessies naast elkaar kunnen werken zonder elkaars server om te
// leggen.
// `process` is Node en niet de browser, dus zonder @types/node struikelt tsc
// erover. Een losse declaratie is genoeg en scheelt een dev-dependency voor
// een enkele regel.
declare const process: { env: Record<string, string | undefined> };
// 127.0.0.1 en niet "localhost": Node zet sinds versie 18 IPv6 vooraan, dus
// "localhost" komt op ::1 uit terwijl uvicorn standaard alleen op IPv4 luistert.
// Dan geeft de proxy ECONNREFUSED en staat de hele app op "Laden" zonder dat er
// iets stuk is.
const API = process.env.PENNEER_API || "http://127.0.0.1:8000";

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
        target: API.replace(/^http/, "ws"),
        ws: true,
      },
      "/api": {
        target: API,
      },
      // Kaart-art van Ontdekken. In productie serveert FastAPI dit pad zelf;
      // in dev moet Vite het doorsturen, anders zoekt hij het in public/.
      "/static": {
        target: API,
      },
    },
  },
});
