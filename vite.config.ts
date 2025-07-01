import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectRegister: null,
      manifest: {
        name: 'Rudder - Goal & Task Scheduler',
        short_name: 'Rudder',
        description: 'A goal-oriented task and scheduling app for productivity',
        theme_color: '#22c55e',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-96.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-128.png',
            sizes: '128x128',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-152.png',
            sizes: '152x152',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-384.png',
            sizes: '384x384',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Add Task',
            short_name: 'Add Task',
            description: 'Quickly add a new task',
            url: '/?action=add-task',
            icons: [
              {
                src: 'icon-192.png',
                sizes: '192x192'
              }
            ]
          },
          {
            name: 'View Schedule',
            short_name: 'Schedule',
            description: 'View today\'s schedule',
            url: '/schedule',
            icons: [
              {
                src: 'icon-192.png',
                sizes: '192x192'
              }
            ]
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    host: true
  }
}) 