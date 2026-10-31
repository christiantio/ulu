# Answer stats prototype (THROWAWAY)

> **This is a throwaway spike for [#17](../../docs/adr/001-answer-stats-backend.md), not production code.**
> Nothing here is deployed and no Cloudflare account is needed. Don't deploy it, and don't build on it
> without reading the ADR's "Consequences" first. It may be deleted at any time.

A Cloudflare Worker with a D1 database that implements the design in
[docs/adr/001-answer-stats-backend.md](../../docs/adr/001-answer-stats-backend.md):

| Route | What it does |
|---|---|
| `POST /answers` | Counts one daily round: the first submission per device per prompt per day, for an open day only. Returns that prompt's shares so far, which is the only way to see today's numbers |
| `GET /stats/:date` | Final shares for a Singapore day that has ended (403 while it's still open), cacheable for a day |
| cron (`scheduled`) | Deletes raw, device-linked rows once a day has closed, and unrecognised-guess counts after 30 days |

| File | |
|---|---|
| `schema.sql` | Tables, counter triggers and the `review_queue` view |
| `src/worker.ts` | Routes, rate limiting, device hashing, CORS |
| `src/rules.ts` | Pure rules: open/closed days, body validation, guess scrubbing |
| `src/tiers.ts` | Pure tier recomputation (the ADR's formula) |
| `src/content.ts` | Bundles the app's packs and `schedule.json` so the Worker can validate submissions |
| `test/*.test.ts` | Unit tests for `tiers.ts` and `rules.ts` |

It imports the app's own `normalize`, date helpers and content from `../../src`, so answers are keyed exactly
as the client matches them.

## How it's kept out of the main project's checks

- **ESLint**: `prototypes` is in the root `eslint.config.js` ignores.
- **TypeScript**: the root `tsconfig.*.json` files only include `src`, `scripts` and `vite.config.ts`, so
  `tsc -b` never sees this folder. It has its own `tsconfig.json` (`npm run typecheck`).
- **Vitest**: the root `vite.config.ts` adds `prototypes/**` to vitest's excludes, so `npm test` at the root
  doesn't run these tests. They run with this folder's `vitest.config.ts` instead (below).
- **Dependencies**: its own `package.json`, with exact versions. None of them are in the root
  `package.json`. The lockfile, `node_modules`, `.wrangler/` and `.dev.vars` are gitignored.

## Run the unit tests (no install needed)

From the **repo root**, using the root's vitest:

```bash
npx vitest run --root prototypes/answer-stats
```

## Run the Worker locally

Needs the Node version in `.tool-versions`. Everything runs on your machine through Miniflare: `--local`
D1, no login and no account. Don't add `--remote`.

```bash
cd prototypes/answer-stats
npm install                 # wrangler, workers-types, typescript, vitest (exact versions)
cp .dev.vars.example .dev.vars
npm run db:init             # applies schema.sql to the local D1 in .wrangler/
WRANGLER_SEND_METRICS=false npm run dev -- --test-scheduled   # http://localhost:8787
npm run typecheck
npm test
```

Try it (use a date in today's Singapore schedule and one of that day's prompt ids):

```bash
curl -s -X POST localhost:8787/answers -H 'Content-Type: application/json' -d '{
  "date": "2026-10-31", "promptId": "transport-ccl-stations",
  "deviceId": "3b241101-e2bb-4255-8caf-4136c566a962",
  "answer": "Dhoby Ghaut", "attempts": ["Bencoolen"]
}'
curl -s localhost:8787/stats/2026-10-30
curl -s "localhost:8787/__scheduled?cron=45+16+*+*+*"     # run the purge
npx wrangler d1 execute ulu-answer-stats --local --command "SELECT * FROM review_queue"
```

### What was checked locally (31 Oct 2026, wrangler 4.150.0)

| Case | Result |
|---|---|
| First submission | 200 `counted: true`, with the prompt's stats |
| Same device and prompt again, different answer | 200 `counted: false, reason: "duplicate"`; counts and guesses unchanged |
| Yesterday's date after the 30-minute grace | 410 `day_closed` |
| A future date | 400 |
| An answer the prompt doesn't have / a prompt not scheduled that day | 422 |
| Body that isn't JSON | 400 |
| `GET /stats/<today>` | 403 `day_in_progress` |
| `GET /stats/<yesterday>` | 200, `final: true`, `Cache-Control: public, max-age=86400` |
| 70 POSTs in a few seconds from one IP | 429 with `Retry-After: 60` after about 60: **the rate-limit binding works in local dev** |
| Preflight from an allowed origin / another origin | 204 with / without `Access-Control-Allow-Origin` |
| Cron | raw rows for closed days deleted, `answer_counts` kept |
| `review_queue` | lists a guess once it passes 5 devices and 1% of plays (checked with hand-edited counts) |

One finding: a first insert into `submissions`, whose trigger also writes `answer_counts`, didn't report
`meta.changes === 1` in local D1 (presumably the trigger's rows are included; the exact value wasn't logged). The
Worker therefore checks `changes > 0`, which is 0 for an ignored duplicate.

## Known gaps (on purpose)

- No integration tests against D1 (would need `@cloudflare/vitest-pool-workers`).
- The guesses insert isn't in the same transaction as the submission insert.
- No migrations, logging, alerting, Turnstile or admin UI.
- `database_id` is a placeholder; there is no real database.
