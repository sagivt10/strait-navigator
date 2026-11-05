# Server contract and verification

Only `dist/` is published. Netlify bundles the Fetch-standard function from `netlify/functions/leaderboard.mjs`, which imports the server modules and the shared unchanged v20 physics/scoring through `dist/replay.js`. No browser Supabase credential exists. Node 22 is pinned. Use `netlify dev` for same-origin API testing; a static file server alone does not provide a leaderboard.

## Endpoints

- `POST /api/runs` has no request body. Returns 201 `{id,token,seed,version,boardVersion,expiresAt}`. Keep the opaque token private to the browser; a completed unsaved replay and token are retained in IndexedDB until acknowledgment or permanent rejection. A challenge expires after 30 minutes (database clock).
- `POST /api/runs/:uuid/submit`, JSON `{token,name,replay:{version,events}}`. Returns 200 `{entry,rank,board,verifiedRun}`. `verifiedRun` is the persisted server-replayed `{state,time,health,hits,distance,supportCollected}` used to render the authoritative score ledger, including on exact retries. Retry the exact same name/replay after a transient/uncertain error. A changed payload after an accepted submission is 409. Expired unsubmitted challenges are 410. Exact accepted retries remain available for at least 30 days with the recommended cleanup schedule.
- `GET /api/leaderboard` returns `{entries,total,version}`; up to 100 entries. `entry` is `{id,name,score,total,time,health,status,rank,submittedAt,version}`. `score` and `total` are equal. Scores always derive from server replay. Rank ordering: score descending, elapsed time ascending, health descending, submitted time ascending, UUID ascending. Each voyage has its own row, even for identical names.
- Errors: `{error:{code,message}}`. Transient storage/config failures return 503 with no private details. 429 carries `Retry-After: 60`; hourly limits may require a longer wait.

The v20 board version is `v20-1`; replay version is `v20-replay-1`. When changing physics or scoring, change both versions to start a fresh comparable board. Old rows stay stored but are filtered out. Replays are capped at 100,000 events, 600 game seconds and 4 MiB JSON. The original JS doubles must not be rounded. Wall-clock verification allows 5 seconds of clock/network tolerance. Pauses are allowed within the 30-minute challenge lifetime.

## Environment and database

Set server-only `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (current `sb_secret_*` key), and `LEADERBOARD_RATE_SALT` (at least 32 random characters). Legacy `SUPABASE_SERVICE_ROLE_KEY` JWT is an optional fallback. Secret keys go only in `apikey`; the legacy JWT also uses Bearer authorization. Keep production and preview deployments on separate Supabase projects (or disable preview secrets) to prevent preview code from accessing production data. Never expose or commit real secrets.

Apply `supabase/migrations/202611050001_leaderboard.sql` once using SQL Editor or CLI. New tables have RLS enabled and no browser access policies. Table grants are revoked from all API roles, including service_role. Only the listed security-definer RPCs may be called by service_role. Functions use a fixed search path and schema-qualified tables. Database time, row locks, one UUID primary key, and digest comparison serialize concurrent requests and preserve idempotency.

No raw IP is stored by application code. The Netlify adapter trusts only provider `context.ip`, not spoofable forwarded headers. HMAC IP buckets are durable in SQL: 120 run starts/hour, 240 submissions/hour, 600 board reads/minute per IP. Limits are intentionally shared-network friendly, not strong bot prevention. Netlify/Supabase may separately retain infrastructure access logs under their policies. Limit changes belong in `server/api.js`.

Schedule `select public.sn_cleanup();` once daily with Supabase Cron/pg_cron or an administrator. It removes old rate buckets, unsubmitted challenges expired over a day ago, and submitted challenges expired over 30 days ago. Entries remain forever. No cleanup job is executed automatically. After enabling Supabase Cron, run `supabase/housekeeping.sql` once to register the named daily 03:17 UTC cleanup job. Before public traffic, configure housekeeping and provider usage/billing alerts. Display names are public; ask players to use nicknames. Plan an admin moderation/removal workflow before a broad launch.

## Verification

`node --test server/api.test.js` runs local in-memory adapter tests, including actual deterministic lost replays, untrusted score rejection, exact retries, concurrent calls, changed-payload conflicts, expiry, wall-clock limits, payload caps, origins, durable-rate behavior, and secret-key header handling. These tests are not a substitute for real database locks or hosted routing.

Run `supabase/smoke.sql` in the project SQL Editor after migration. It validates grants/RLS, insert, idempotency, conflict and rate limit, then rolls back all smoke rows. For real concurrent database verification in a disposable project: create one challenge, set its start time at least 120 seconds earlier using SQL Editor, then issue two simultaneous `sn_submit` RPC calls with the same ID/token hash/digest and result; assert two 200 responses but one `sn_entries` row. Repeat using different digests: one accepted and one conflict. These are server-only test calls; never put the service secret in browser JS. Check anonymous/normal-user table and RPC requests are rejected. Submit a genuine won voyage and lost voyage under one nickname and verify two distinct rows. Confirm retry of an already accepted challenge after its expiry returns the same row, and test a new valid challenge plus an expired unsubmitted challenge through Netlify's deployed routes. Verify the normal game can post a legitimate replay and that API outages leave a retryable result.

No actual provider deployment, authenticated database migration, or real concurrent SQL test has been performed while preparing this package. No PostgreSQL binary was available locally. The SQL smoke test must be run in the destination staging project before launch.

## Security boundary

This prevents fabricated client totals and accidental duplicate rows. It is not cheat-proof: the public deterministic simulation can be automated and searched for favorable inputs, and a sufficiently patient bot can respect wall-clock limits. Tokens authenticate a run, not a human or account. Random seeds only affect support randomness, not every obstacle. There is no login, per-player best replacement, or retry score penalty. Do not describe ranks as authenticated human competition.
