/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(() => {
  const base = process.env.GITHUB_ACTIONS === 'true' ? '/budget-calendar/' : '/'

  return {
    base,
    plugins: [react(), VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: '预算日历',
        short_name: '预算日历',
        description: '发薪周期动态预算与快速记账',
        theme_color: '#f7f5f0',
        background_color: '#f7f5f0',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
    })],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      clearMocks: true,
    },
  }
})
