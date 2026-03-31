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
        secure: false,                   // não verifica cert SSL (evita erros de cadeia)
        headers: {
          Origin:  'https://opus1.cloud',
          Referer: 'https://opus1.cloud/client/',
        },
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.error('[proxy error]', err.message)
            if (!res.headersSent) {
              (res as import('http').ServerResponse).writeHead(502, { 'Content-Type': 'application/json' })
              ;(res as import('http').ServerResponse).end(
                JSON.stringify({ errorresponse: { errorcode: 502, errortext: `Proxy error: ${err.message}` } })
              )
            }
          })
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log('[proxy →]', req.method, req.url)
          })
          proxy.on('proxyRes', (proxyRes, req) => {
            if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
              console.warn('[proxy ←]', proxyRes.statusCode, req.url)
            }
          })
        }
      }
    }
  }
})
