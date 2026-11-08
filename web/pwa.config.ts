import type { VitePWAOptions } from 'vite-plugin-pwa'

const LIGHT_PAGE = '#f9f9f7'

export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  includeAssets: ['favicon.svg'],
  manifest: {
    name: 'Room Climate',
    short_name: 'Climate',
    description: 'Temperature and humidity of every room at home',
    start_url: '/',
    display: 'standalone',
    theme_color: LIGHT_PAGE,
    background_color: LIGHT_PAGE,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    // Only the built static files are precached; readings must always be live.
    navigateFallbackDenylist: [/^\/api(\/|$)/],
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
        handler: 'NetworkOnly',
      },
    ],
  },
}
