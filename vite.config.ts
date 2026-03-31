import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/client/api': {
        target: 'https://opus1.cloud',
        changeOrigin: true,
        secure: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('[proxy error]', err.message)
          })
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log('[proxy →]', req.method, req.url)
          })
        }
      }
    }
  }
})
