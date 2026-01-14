import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';

// Pages that support path-based blog routing: /:blogname/:page/
const BLOG_PAGES = ['archive', 'timeline', 'following', 'social'];

// Non-blog pages: /:page/
const STATIC_PAGES = ['search', 'blogs', 'home', 'clear-cache'];

/**
 * Custom plugin to handle path-based routing in development.
 * Rewrites /:blogname/:page/ to /:page.html?blog=:blogname
 */
function pathBasedRoutingPlugin(): Plugin {
  return {
    name: 'path-based-routing',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';

        // Skip API calls, assets, and existing .html files
        if (
          url.startsWith('/api') ||
          url.startsWith('/src/') ||
          url.startsWith('/@') ||
          url.startsWith('/node_modules') ||
          url.includes('.') // Has file extension
        ) {
          return next();
        }

        // Parse the path
        const parts = url.slice(1).split('/').filter(Boolean);

        // Handle /:page/ for static pages
        if (parts.length === 1 && STATIC_PAGES.includes(parts[0])) {
          req.url = `/src/pages/${parts[0]}.html`;
          return next();
        }

        // Handle / -> home
        if (parts.length === 0 || url === '/') {
          req.url = '/src/pages/home.html';
          return next();
        }

        // Handle /:blogname/ -> archive with blog param
        if (parts.length === 1 && !STATIC_PAGES.includes(parts[0])) {
          req.url = `/src/pages/archive.html?blog=${encodeURIComponent(parts[0])}`;
          return next();
        }

        // Handle /:blogname/:page/ -> :page with blog param
        if (parts.length >= 2 && BLOG_PAGES.includes(parts[1])) {
          req.url = `/src/pages/${parts[1]}.html?blog=${encodeURIComponent(parts[0])}`;
          return next();
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [pathBasedRoutingPlugin()],
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'src/pages/home.html'),
        search: resolve(__dirname, 'src/pages/search.html'),
        blogs: resolve(__dirname, 'src/pages/blogs.html'),
        'clear-cache': resolve(__dirname, 'src/pages/clear-cache.html'),
        archive: resolve(__dirname, 'src/pages/archive.html'),
        timeline: resolve(__dirname, 'src/pages/timeline.html'),
        following: resolve(__dirname, 'src/pages/following.html'),
        social: resolve(__dirname, 'src/pages/social.html'),
      },
    },
  },
  server: {
    open: '/home',
    proxy: {
      '/api': {
        target: 'https://api-staging.bdsmlr.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
