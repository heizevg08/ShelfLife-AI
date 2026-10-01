import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // public/manifest.webmanifest is the single manifest source.
      manifest: false,
      injectRegister: false,
      registerType: "prompt",
      includeAssets: [
        "icons/*.png",
        "icons/*.svg",
        "fonts/*.woff2",
        "manifest.webmanifest",
      ],
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,svg,webmanifest}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
        importScripts: ["/sw-cleanup.js"],
      },
    }),
  ],
  // Preserve the existing browser origin and backend CORS/cookie policy.
  server: { host: "localhost", port: 5173, strictPort: true },
  preview: { host: "localhost", port: 5173, strictPort: true },
});
