import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    // Cible des webviews modernes : Edge WebView2 (Windows) et WebKit (macOS / Linux).
    target: "es2021",
    outDir: "dist",
  },
});
