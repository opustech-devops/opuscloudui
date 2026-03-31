import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
  const proxyConfig = {
    '/client/api': {
      target: 'https://opus1.cloud',
      changeOrigin: true,
      secure: false,
      headers: {
        Origin:  'https://opus1.cloud',
        Referer: 'https://opus1.cloud/client/',
      },
      cookieDomainRewrite: { 'opus1.cloud': 'localhost' },
      configure: (proxy: import('http-proxy').Server) => {
        proxy.on('error', (err, _req, res) => {
          console.error('[proxy error]', err.message)
          if (!(res as import('http').ServerResponse).headersSent) {
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
          const setCookie = proxyRes.headers['set-cookie']
          if (setCookie) {
            proxyRes.headers['set-cookie'] = setCookie.map(c =>
              c.replace(/;\s*Domain=[^;]*/gi, '').replace(/;\s*Secure/gi, '')
            )
          }
          if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
            console.warn('[proxy ←]', proxyRes.statusCode, req.url)
          }
        })
      }
    }
  }

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: proxyConfig,
    },
    preview: {
      port: 3001,
      proxy: proxyConfig,
    },
  }
})
