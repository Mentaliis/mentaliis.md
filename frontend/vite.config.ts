import { readFileSync } from "node:fs";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/** Le numero de version n'a qu'une source : le package.json de la racine. */
const version = JSON.parse(readFileSync("../package.json", "utf8")).version as string;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  define: {
    // Fige l'identite de cette edition au moment ou elle est construite. Une
    // annee lue a l'execution deriverait sur la machine de celui qui lit ;
    // celle-ci reste celle de la version qu'il utilise.
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_YEAR__: JSON.stringify(String(new Date().getFullYear())),
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  // Les tests de l'interface : de la logique pure, verifiee sans navigateur.
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.tsx", "src/**/*.test.ts"],
    globals: true,
  },
  build: {
    // Cible des webviews modernes : Edge WebView2 (Windows) et WebKit (macOS / Linux).
    target: "es2021",
    outDir: "dist",
    // Les cartes de source voyagent avec l'application : sans elles, une panne
    // ne nomme qu'un identifiant minifie — « Kv » — et l'on ne peut rien en
    // faire. Avec elles, le message designe le fichier et la ligne exacts.
    sourcemap: true,
  },
});
