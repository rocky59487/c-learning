import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build` makes the installable web app (dist/).
// `npm run build:single` makes one self-contained HTML file (dist-single/index.html).
export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  return {
    base: './',
    define: { __SINGLE__: JSON.stringify(single) },
    plugins: single
      ? [
          react(),
          viteSingleFile(),
          {
            name: 'no-pwa',
            resolveId: (id: string) => (id === 'virtual:pwa-register' ? '\0no-pwa' : null),
            load: (id: string) => (id === '\0no-pwa' ? 'export function registerSW() {}' : null),
          },
        ]
      : [
          react(),
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon-192.png', 'icon-512.png'],
            manifest: {
              name: '工程測量乙級學科',
              short_name: '測量乙級',
              lang: 'zh-Hant',
              start_url: './',
              display: 'standalone',
              background_color: '#f4f6f8',
              theme_color: '#1d5fa8',
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
              ],
            },
            workbox: { globPatterns: ['**/*.{js,css,html,png,json}'], maximumFileSizeToCacheInBytes: 5_000_000 },
          }),
        ],
    build: single
      ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000, cssCodeSplit: false }
      : { outDir: 'dist' },
  }
})
