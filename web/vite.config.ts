import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { pwaOptions } from './pwa.config.ts'

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA(pwaOptions)],
  build: {
    // The lazily loaded ECharts chunk is ~520 kB on its own.
    chunkSizeWarningLimit: 600,
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8080',
    },
  },
})
