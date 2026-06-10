import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import { stabilizeEntryBundle } from './scripts/stabilize-entry-bundle.mjs';

/**
 * Simple SPA fallback plugin for Vite.
 * Serves index.html for all non-file/non-api requests.
 */

function stableEntryBundlePlugin(): Plugin {
  return {
    name: 'stable-entry-bundle',
    apply: 'build',
    writeBundle(outputOptions) {
      const outDir = typeof outputOptions.dir === 'string' ? resolve(__dirname, outputOptions.dir) : resolve(__dirname, 'dist');
      stabilizeEntryBundle(outDir);
    },
  };
}

function spaFallbackPlugin(): Plugin {
  return {
    name: 'spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (
          url.startsWith('/api') ||
          url.startsWith('/v2/api') ||
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
  base: '/v2/assets/',
  plugins: [spaFallbackPlugin(), stableEntryBundlePlugin()],
  build: {
    target: 'es2020',
    assetsDir: '',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    open: '/',
    proxy: {
      '/v2/api/recs': {
        target: 'http://100.69.66.115:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/v2\/api\/recs/, ''),
        secure: false,
      },
      '/v2/api': {
        target: 'https://api-staging.bdsmlr.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
