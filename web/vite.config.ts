import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
