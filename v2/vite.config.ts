import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        search: resolve(__dirname, 'src/pages/search.html'),
        archive: resolve(__dirname, 'src/pages/archive.html'),
        timeline: resolve(__dirname, 'src/pages/timeline.html'),
        activity: resolve(__dirname, 'src/pages/activity.html'),
        social: resolve(__dirname, 'src/pages/social.html'),
      },
    },
  },
  server: {
    open: '/src/pages/search.html',
    proxy: {
      '/api': {
        target: 'https://api-staging.bdsmlr.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: true,
      },
    },
  },
});
