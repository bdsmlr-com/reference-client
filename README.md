# reference-client

A reference implementation client for the BDSMLR API.

## API Documentation

The OpenAPI specification for the public read API is available at:

https://api-staging.bdsmlr.com/v2/public-read-api-v2/docs/spec.json

## CI Verification Commands

Run from `v2/`:

- Focused regression harness: `npm run test:ci:focused`
- Known-green broad harness: `npm run test:ci:broad`

The full test suite is not currently green. See `v2/vitest.ci.config.ts` for the
documented temporary exclusions used by the known-green broad harness.
