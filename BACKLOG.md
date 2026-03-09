Diagnosis Summary
The JS client cannot authenticate because the API login response fields are camelCase
(accessToken, expiresIn), while the client expects snake_case (access_token, expires_in).
This causes the client login to throw, so downstream API requests never execute.

Evidence
- Staging login endpoint returns camelCase fields (e.g. accessToken).
- Client login parsing requires access_token in `third-party/reference-client/v2/src/services/api.ts`.
- Auth token works when manually using accessToken and then calling `/api/v2/*` endpoints.
- API and ES are reachable from staging: `/healthz` and `/healthz/es` return 200.

Backlog
1) Pragmatic hotfix (ASAP): make the JS client accept both camelCase and snake_case auth fields.
   - Update `third-party/reference-client/v2/src/services/api.ts` to fall back from
     access_token -> accessToken and expires_in -> expiresIn.
   - This avoids touching the API contract and restores client traffic quickly.
   - Note: if consuming the built bundle, run `npm run build` in `third-party/reference-client/v2` after changes. (done)
   - Gotcha: blog resolution may return snake_case (`blog_id`/`blog_name`). Added fallback in resolver parsing. (done)
   - Gotcha: default API base must include `/api` for staging; otherwise requests hit `/v2/*` and fail (405). Set default to `/api`. (done)
   - Gotcha: cached "blog not found" entries can persist; added one-time bypass to re-resolve. (done)
   - Outcome: timeline page now shows content on staging. (done)
2) Debug/diagnostic toggle (high): add an env var to disable client caching in builds, or expose a UI action to clear caches.
   - Implemented: shared nav now includes a "Clear cache" link to a dedicated clear-cache page that wipes storage and alerts before returning. (done)
   - Reported: clicking "Clear cache" on mobile appears to do nothing; moved logic to `/clear-cache` page to avoid click-handler issues. (new)
   - Outcome: `/clear-cache` page refreshes and clears; confirmed working. (done)
   - Future: `VITE_DISABLE_CLIENT_CACHE=true` to bypass localStorage caches and SWR.
3) Investigate empty Following + Social pages on staging. (done)
   - Timeline shows content for nonnudecuties, but `/following/` and `/social/?tab=followers` render empty.
   - Verify API responses for follow graph and followers on staging; compare with timeline behavior.
   - Implemented: follow graph ES queries now accept both `type` + `activity_type` fields and `blog_id` + `target_blog_id` targets; added hit fallback to avoid empty agg results. (done)
   - Verified staging (nonnudecuties): `/api/v2/blog-follow-graph` returns followers + following with counts. (done)
   - Root cause for UI empty: client mapped follower direction to 0 (both), which times out on staging; updated client to use correct enum mapping (followers=2, following=1, both=0) and social tab now uses direction 2. Requires rebuild/deploy of reference client assets. (done)
   - Gotcha: server was returning `followers_count`/`following_count` as page size (len of page), so Social tab showed `100/8`; added cardinality aggs to return total counts. Requires gunicorn reload. (done)
   - Added: Social page now treats count>0 + empty first page as a retryable error, bypasses cache, and surfaces the standard retry UI. Requires rebuild/deploy. (done)
   - Outcome: Social and Following load on staging after deploy + reload; counts reflect totals and retry UX matches other pages. (done)
4) Following feed still broken on staging (https://api-staging.bdsmlr.com/nonnudecuties/following/). (done)
   - Root cause: `/api/v2/list-blogs-recent-activity` returns `items` (BlogRecentActivity) only; client expects `posts`.
   - Implemented: API now includes `posts` in response for both global-merge and legacy modes by hydrating post IDs.
   - Gotcha: this is a contract divergence (extra `posts` field not in proto); requires deploy to staging to take effect.
5) Following page shows "not following anyone" on transient follow-graph timeouts (e.g. Kinkyoffice). (done)
   - Implemented: first empty response now shows retryable error state instead of "not following".
   - Retry bypasses cache; on second empty result, falls back to "not following" status.
6) Quota exceeded errors after caching recent activity posts. (done)
   - Root cause: recent activity cache writes could exceed localStorage quota once posts are included in responses.
   - Implemented: guard recent activity cache writes and clear cache on quota errors to prevent retry storms.
2) Short-term resilience: add a client-side warning when login field mismatch occurs. (done)
   - Implemented a one-time console warning when camelCase auth fields are detected.
   - Improved auth parsing error to explicitly state missing access_token/accessToken blocks API calls.
   - Helps diagnose future regressions without deep debugging.
   - Status update: build verified as working.
   - Gotcha: `https://api-staging.bdsmlr.com/nonnudecuties/following/` still broken; needs investigation.
3) Contract correctness (lower priority, coordinated change across API + client).
   - Server: standardize auth responses to snake_case (access_token/expires_in/token_type).
   - Client: keep the fallback for a while to support mixed deployments, then remove.
   - Update OpenAPI + generated SDKs to reflect the canonical field names.
4) Type alignment cleanup (lower priority, deeper fix).
   - Normalize enum encoding and numeric types between proto, API, and JS client.
   - Add integration tests to validate enum values and payload shapes.
5) Contract tests (lower priority, guardrails).
   - Add an integration test hitting `/api/v2/auth/login` and asserting response fields.
   - Add a smoke test for a read API call using the issued token.
