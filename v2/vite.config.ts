import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';

/**
 * Simple SPA fallback plugin for Vite.
 * Serves index.html for all non-file/non-api requests.
 */
function spaFallbackPlugin(): Plugin {
  return {
    name: 'spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (
          url.startsWith('/api') ||
          url.startsWith('/src/') ||
          url.startsWith('/@') ||
          url.startsWith('/node_modules') ||
          url.includes('.')
        ) {
          return next();
        }
        // Fallback to index.html
        req.url = '/index.html';
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [spaFallbackPlugin()],
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    open: '/',
    proxy: {
      '/api/recs': {
        target: 'http://100.69.66.115:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/recs/, ''),
        secure: false,
      },
      '/api': {
        target: 'https://api-staging.bdsmlr.com',
        changeOrigin: true,
        secure: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req) => {
            // Dev-only cookie mangling to allow HTTP localhost to store auth cookies.
            // The origin server sets Secure cookies (correct for prod), but that breaks
            // local HTTP dev behind a proxy.
            const host = String(req.headers.host || '');
            if (!host.startsWith('localhost') && !host.startsWith('127.0.0.1')) return;

            const setCookie = proxyRes.headers['set-cookie'];
            if (!setCookie) return;
            const cookies = Array.isArray(setCookie) ? setCookie : [String(setCookie)];
            proxyRes.headers['set-cookie'] = cookies.map((c) =>
              c
                .replace(/;\s*Secure/gi, '')
                // When proxying to localhost, a Domain=api-staging... cookie will be rejected.
                // Host-only cookies (no Domain attr) will store for localhost.
                .replace(/;\s*Domain=[^;]+/gi, '')
                // If server ever sets SameSite=None, make it compatible with HTTP dev.
                .replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
            );
          });
        },
      },
    },
  },
});
