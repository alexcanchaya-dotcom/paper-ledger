import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

// GitHub Pages project sites need a subpath, e.g. BASE_PATH=/paper-ledger/
// Vercel / Netlify / a custom domain should leave this unset (defaults to /).
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": resolve(root, "src"),
    },
  },
});
