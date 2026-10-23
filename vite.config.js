import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Для GitHub Pages проект живёт по адресу /love-game/. Для другого хостинга: VITE_BASE=/ npm run build
const base = process.env.VITE_BASE || '/love-game/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'ASK ME', short_name: 'Ask Me', description: 'Откровенные разговоры для двоих и компании',
        lang: 'ru', start_url: base, scope: base, display: 'standalone', orientation: 'portrait',
        background_color: '#0a0710', theme_color: '#0a0710',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html'
      }
    })
  ],
  build: { target: 'es2019', sourcemap: false, rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom'] } } } }
});
