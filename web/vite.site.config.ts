// The project site for GitHub Pages: the landing page plus the app running on simulated
// data (docs/design/site.md). No PWA plugin, so the demo never installs a service worker.
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const site = (path: string) => fileURLToPath(new URL(`site/${path}`, import.meta.url))

export default defineConfig({
  root: 'site',
  base: '/room-climate-monitor/',
  // Two plain pages and no SPA fallback, like GitHub Pages: a missing file is a 404.
  appType: 'mpa',
  publicDir: '../public',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist-site',
    emptyOutDir: true,
    // The lazily loaded ECharts chunk is ~520 kB on its own.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: { index: site('index.html'), demo: site('demo/index.html') },
    },
  },
})
