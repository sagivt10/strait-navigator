# Strait Navigator v20: deployment and leaderboard package

Start with **[מדריך פריסה בעברית](DEPLOY.he.md)**.

This is a local migration package, not a deployed release. It keeps the approved v20 gameplay, ship, captain, audio and score formula. It adds a real, no-login, per-voyage leaderboard backed by server replay validation and Supabase Postgres.

- `dist/`: complete browser game, leaderboard, privacy notice and all assets.
- `server/`, `netlify/functions/`, `netlify.toml`: same-origin API and Netlify server function.
- `supabase/migrations/`: additive new schema; existing game tables remain untouched.
- `supabase/smoke.sql`: rollback-only database smoke test after installing the schema.
- `tools/legacy-*`, `docs/LEGACY-MIGRATION.he.md`: explicit preparation for the old score tables. Legacy values are not relabeled as verified v20 results.
- `docs/VALIDATION.md`: what was tested and what still needs the destination environment.
- `server/BACKEND.md`: protocol, limits, deployment and security details.

Requires Node 22+. No application dependencies or build step are required for the static game. Netlify bundles the server function when deploying the complete project.

```sh
npm test
npm run verify
```

Do not upload only `dist/` with Netlify drag-and-drop: that omits the API. Do not place any Supabase server key in the browser. Real deployment, database changes, account sign-in and DNS changes have not been performed.

## Competition policy

Each completed ranked voyage is a distinct entry, including losses. There is no sign-up, best-per-player replacement or retry penalty. A nickname is not an identity. Practice and abandoned/restarted voyages are not submitted. Ranking is bounded to 10 active minutes, 100,000 input events, 4 MiB, and a 30-minute server ticket including pauses. Network failures are explicit and completed runs use a persistent browser outbox with idempotent retries.

Server replay rejects invented totals and impossible replay histories. It does not prevent bots, tool-assisted play, seed optimization or nickname impersonation. Use a separate rules/board version when physics or scoring changes.
