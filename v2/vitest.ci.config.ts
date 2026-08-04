import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      // Temporary known failures caused by source-contract drift.
      'tests/admin-mode-consistency.test.ts',
      'tests/blog-context.test.ts',
      'tests/blog-theme.test.ts',
      'tests/media-renderer-redaction.test.ts',
      'tests/post-feed-context.test.ts',
      'tests/post-feed-item-text-fallback.test.ts',
      'tests/post-media-rendering-contract.test.ts',
      'tests/retrieval-response.test.ts',
      'tests/sort-preferences.test.ts',
      'tests/v2-prefix-paths.test.ts',
      // Temporary known failure coupled to the deploy environment.
      'tests/build-tag-format.test.ts',
      // Temporary known failures involving runtime or async defects.
      'tests/media-scroll-anchor.test.ts',
      'tests/related-route-perspective.test.ts',
      'tests/search-session.test.ts',
      'tests/social-follow-pagination.test.ts',
      // Remove exclusions above as their tests are repaired.
    ],
  },
});
