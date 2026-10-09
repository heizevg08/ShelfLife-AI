import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    manifest: false, injectRegister: false, registerType: 'prompt',
    includeAssets: ['icons/*.png', 'icons/*.svg', 'fonts/*.woff2', 'manifest.webmanifest'],
    workbox: { globPatterns: ['**/*.{js,css,html,woff2,png,svg,webmanifest}'], navigateFallback: '/index.html', navigateFallbackDenylist: [/^\/api(?:\/|$)/], runtimeCaching: [], cleanupOutdatedCaches: true, importScripts: ['/sw-cleanup.js'] },
  })],
  server: { host: 'localhost', port: 8081, strictPort: true },
  preview: { host: 'localhost', port: 8081, strictPort: true },
});
