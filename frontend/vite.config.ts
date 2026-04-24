import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import packageJson from './package.json'

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || packageJson.version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.WS_PROXY_TARGET || 'ws://localhost:8080',
        ws: true,
      },
    },
  },
})
