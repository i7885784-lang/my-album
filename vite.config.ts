import { defineConfig } from "vite";
export default defineConfig({
  publicDir: "public",
  build: { outDir: "dist" },
  server: { host: "0.0.0.0" },
});
