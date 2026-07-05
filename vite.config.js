import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Remplace "nexus-mouride" ci-dessous par le nom EXACT de ton dépôt GitHub
// si tu choisis un autre nom.
export default defineConfig({
  plugins: [react()],
  base: "/nexus-mouride/",
});
