# Validation report — 2026-11-05

## Passed locally

- `npm test`: **36/36 test suites passed**. Includes all 31 inherited v20 gameplay/presentation suites, replay tests, browser-client tests, ranked flow integration, server API tests and legacy migration preparation tests.
- Replay coverage: **22 complete real simulation trajectories** at 20/30/60/120/240 fps and mixed zero/variable frame times. Server replay exactly reproduces local state and score, including 30 ordered interceptions, 40 physical supply pickups, docking progress, wins and losses. This is simulated steering, not human playtesting.
- Backend: **9 tests** with injected in-memory store, including actual replays, client score spoofing, run token separation, same-name multiple voyages, exact concurrent retry, changed-payload conflict, uncertain committed write recovery, wall-clock/expiry/version bounds, payload caps, rate handling and secret-key header format.
- Client: outbox per run without last-three eviction, lost response retries, expired receipt reconciliation, blocked/full storage fallback, throwing IndexedDB getter safety, server-seed integration, repeated Start, Help and blur while connecting, stale response isolation, real rank announcements and escaped nicknames.
- Replay time/event/encoded-byte caps turn an ongoing run visibly into practice. Existing physical gameplay does not change.
- Legacy import preparation: **11 tests**, strict source identity, exact raw data preservation, explicit conversions, duplicate/rejected row accounting, unchanged reruns, changed-key conflicts and safe review-SQL escaping.
- Supplied legacy exports: all 100 ordinary + 15 daily rows prepared, no rejected/duplicate rows. Original score sums: 529158 and 117697. This does not establish complete live-source counts. Zero times and scores are preserved rather than guessed.
- Browser smoke test of local static preview: leaderboard unavailable state contains no fabricated rivals; Refresh remains usable; privacy page renders. The browser reports WebGL unavailable, so the full sea/game renderer was not validated there.
- Independent code review checked replay, SQL authorization/idempotency, ranking, outbox and legacy separation boundaries.

`npm run verify` additionally checks byte hashes of untouched approved v20 files/assets and parses all JavaScript modules. `docs/V20-BASELINE.json` records those hashes. Gameplay `logic.js` and `scoring.js`, all models/audio and unmodified visual controllers are byte-identical to the approved v20 bundle. UI/backend-related additions are intentional.

## Not run here; required before production cutover

- Real PostgreSQL migration, Supabase grants/RLS smoke test and two-client transaction concurrency. There is no local PostgreSQL binary or authorized database connection in this preparation environment. Run the included SQL smoke checks in staging.
- Netlify function bundling, deployed route rewrites/path configuration and real server-only environment secrets. A static server cannot prove these paths. Use a complete Functions deployment, not static drag-and-drop.
- Actual live-source schema/count confirmation for the old tables. CSV headers and data do not prove SQL types, defaults, keys, grants or RLS. Confirm the project/table identity and complete exports before applying the prepared legacy SQL.
- Legacy archive DDL and data import. No SQL was executed. Private import files are supplied separately from source; never put them in Git, dist or Netlify.
- Physical phone/GPU performance, mobile controls and audible playback. Existing automated/headless tests do not replace these checks.

## Scope and limits

No new hosting project, login, deployment, DNS change, database mutation, credential creation or external infrastructure change was performed. No existing old-game row was changed. Verification is replay feasibility, not proof of human play: bots, assisted inputs and nickname impersonation remain possible. No best-per-player policy or retry penalty was introduced.
