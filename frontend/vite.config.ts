import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'security-headers',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Content-Security-Policy
          const isProduction = process.env.NODE_ENV === 'production';
          
          // Конфигурация CSP для development режима
          const cspPolicy = isProduction
            ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self' http://localhost:* ws://localhost:*; object-src 'none'; frame-src 'none'; frame-ancestors 'none'"
            : "default-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http://localhost:*; font-src 'self' data: https:; connect-src 'self' http://localhost:* ws://localhost:* https://* wss://*; object-src 'none'; frame-src 'none'; frame-ancestors 'none'";

          res.setHeader('Content-Security-Policy', cspPolicy);
          
          // X-Frame-Options
          res.setHeader('X-Frame-Options', 'DENY');
          
          // X-Content-Type-Options
          res.setHeader('X-Content-Type-Options', 'nosniff');
          
          // Referrer-Policy
          res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
          
          // Permissions-Policy
          res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), autoplay=(), fullscreen=(self)');
          
          // Strict-Transport-Security (только в production)
          if (isProduction) {
            res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
          }
          
          next();
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            // Подавляем ошибку ECONNREFUSED при старте, если бэкенд еще не успел запуститься
            if (err && (err as any).code === 'ECONNREFUSED') {
              console.log('⏳ Ожидание запуска бэкенда на порту 5000...');
            }
          });
        },
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
      },
    },
  },
})
