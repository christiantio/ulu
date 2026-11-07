# ADR 001: Backend for anonymous answer stats and data-driven tiers

- **Status:** Proposed. **The team decides**; this records a recommendation, not a decision.
- **Date:** 2026-10-31
- **Issue:** #17 (roadmap step 2 in [ARCHITECTURE.md](../../ARCHITECTURE.md#roadmap))
- **Prototype:** [`prototypes/answer-stats/`](../../prototypes/answer-stats/README.md), a throwaway that implements the recommendation and runs locally only

## Context

Ulu's pitch is Krillion's: "only 3% of players said this". Today every tier is an editorial guess
([How rarity is decided](../../ARCHITECTURE.md#how-rarity-is-decided-now-and-later)), and the app is a static bundle
with no backend. We want to:

1. count which answer each player gives for each daily prompt, anonymously;
2. show "X% of players found this" after a round;
3. recompute tiers from real shares, with the editorial tier as the prior, and detect `trap` answers;
4. turn unrecognised guesses that many players type into a review queue, replacing the manual form planned in #9.

Constraints:

- **No accounts**, so dedupe and abuse control have to work without logins.
- **Fairness.** Everyone gets the same tiers on a given day ([Fairness & persistence](../../ARCHITECTURE.md#fairness--persistence)).
  Answers and tiers already ship in the client bundle, and will still ship one day at a time after #18.
- **Inputs from in-flight work.** #9 adds `attempts: string[]` (rejected guesses) to `RoundResult` and a "Should this
  count?" link. #3 compares Cloudflare Pages, Vercel and Netlify for hosting.
- **Near-zero traffic and budget** to start. The team is small and works in TypeScript.
- **Players are in Singapore.** The relevant privacy law is the PDPA.

## Options

Facts below were checked **as of 2026-10-31** against the pages linked. Pricing and limits change, so re-check them
before deciding. Anything marked **unverified** could not be confirmed from a primary source.

| | **A. Cloudflare Workers + D1** | **B. Supabase (Postgres + PostgREST/Edge Functions)** |
|---|---|---|
| Free tier: compute | 100,000 Worker requests/day, 10 ms CPU per invocation ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)) | 500,000 Edge Function invocations/month ([Supabase pricing](https://supabase.com/pricing)) |
| Free tier: database | D1: 5 M rows read/day, 100,000 rows written/day, 5 GB storage ([D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), page dated 30 Oct 2026) | 500 MB database per project, 5 GB egress, 2 active projects ([Supabase pricing](https://supabase.com/pricing)) |
| Idle behaviour | No pausing documented | **Free projects pause after 1 week of inactivity** ([Supabase pricing](https://supabase.com/pricing)) |
| First paid step | Workers Paid, from US$5/month: 10 M requests/month, 25 B D1 rows read/month and 50 M rows written/month included | Pro, from US$25/month |
| Cost at zero traffic | US$0 | US$0, but the project pauses during quiet weeks (e.g. before launch) |
| Singapore region | Workers run at the Cloudflare location that takes the request (**unverified** for Singapore traffic specifically). D1's primary has **no Singapore option**, only an `apac` location hint, and "Providing a location hint does not guarantee that D1 runs in your preferred location" ([D1 data location](https://developers.cloudflare.com/d1/configuration/data-location/), page dated 2 Oct 2026). D1 read replication exists; its beta or GA status is **unverified** | **Explicit Singapore region**, `ap-southeast-1` ([Supabase regions](https://supabase.com/docs/guides/platform/regions)) |
| Latency from Singapore | **Unmeasured.** Nothing was deployed for this spike. Expect a fast edge hop plus one round trip to wherever the `apac` primary ends up | **Unmeasured.** The database would be in Singapore. Edge Functions run "on a regionally-distributed Edge Runtime node closest to the user" ([Edge Functions](https://supabase.com/docs/guides/functions)), then call the database |
| Rate limiting | Built-in [Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/): 10 s or 60 s windows, counted per Cloudflare location, eventually consistent. Pricing isn't stated on that page (**unverified**). Works in `wrangler dev` (checked in the prototype) | None documented. The Edge Functions guide's rate-limiting example uses Upstash Redis ([Edge Functions](https://supabase.com/docs/guides/functions)). PostgREST alone would need a counter table (**unverified** whether anything newer exists) |
| Local development | `wrangler dev --local` emulates the Worker, D1 and the rate limiter with no account. Checked in the prototype | `supabase start` runs the stack locally in Docker (**not tried** in this spike) |
| Team ergonomics | One TypeScript file plus SQLite. Can bundle the app's own `normalize()` and content. Can sit on the same origin as the site if #3 picks Cloudflare | Real Postgres. A dashboard table editor would give non-developers an easy view of the review queue (**not tried**). Edge Functions run on a "Deno compatible runtime" ([Edge Functions](https://supabase.com/docs/guides/functions)), a second runtime to learn |
| Fit with hosting (#3) | Same account and origin as Cloudflare Pages: no CORS and one dashboard. Works cross-origin from Vercel or Netlify too | Neutral: cross-origin from any static host |

A rough capacity check for A, as an estimate: a daily dive is 7 `POST /answers`, plus up to 7 CORS preflights if
the API is cross-origin. Each POST writes about 2 to 4 D1 rows (the submission, its counter, and the guesses with
their counters). The free tier's 100,000 written rows/day therefore covers roughly **4,000–7,000 dives a day**.
Past that, the next tier is US$5/month.

## Recommendation

**Option A, Cloudflare Workers + D1**, to be confirmed by the team.

- It costs nothing at zero traffic and doesn't pause, which suits a hobby game with uneven traffic. The
  free quotas cover a few thousand daily players.
- It has a rate limiter built in, and its local emulation is complete. The prototype ran end to end with no
  account.
- It's TypeScript end to end and can import `src/game/normalize.ts` and the packs. The server then keys answers
  exactly as the client matches them.
- If #3 picks Cloudflare Pages, the API can be same-origin (`/api/*`), with no CORS and no preflights.

**The strongest case for B:** Supabase offers a guaranteed Singapore region, which helps with latency and PDPA
transfer questions. Its table editor is also a friendlier home for the review queue. If the team rules that the
data must stay in Singapore (see [Privacy](#privacy-pdpa)), choose B. The schema below ports almost unchanged to
Postgres: the triggers become PL/pgSQL, and `POST /answers` becomes a `security definer` RPC or an Edge Function.

## Design

### API

All dates are Singapore dates (`YYYY-MM-DD`), computed the same way as `singaporeDateKey()`. Only **daily** rounds
are sent. Unlimited rounds are never counted.

**`POST /answers`**, sent once per daily round, as soon as the round ends.

```jsonc
// request
{
  "date": "2026-10-31",
  "promptId": "transport-ccl-stations",
  "deviceId": "3b241101-e2bb-4255-8caf-4136c566a962", // random v4 UUID, see "Device id"
  "answer": "one-north",                               // matched canonical name, or null for a miss
  "attempts": ["Bencoolen", "Bras Brasah"]             // RoundResult.attempts from #9: rejected guesses only
}

// 200: counted, or a duplicate (the first submission stands). Either way, the prompt's stats so far
{
  "counted": true,                       // false + "reason": "duplicate" for a repeat
  "stats": {
    "promptId": "transport-ccl-stations",
    "plays": 412,                        // every counted submission today, misses included
    "misses": 37,
    "answers": [                         // most picked first; answers nobody gave are left out
      { "name": "Dhoby Ghaut", "count": 88, "share": 0.2136 },
      { "name": "one-north", "count": 17, "share": 0.0413 }
    ]
  }
}
```

| Status | When |
|---|---|
| 400 | Malformed body, or a future date |
| 410 `{ "counted": false, "reason": "day_closed" }` | The day ended more than 30 minutes ago |
| 422 | The prompt isn't scheduled on that date, or the answer isn't one of its canonical names |
| 429 + `Retry-After` | Rate limited |

The server bundles the same packs and `schedule.json` as the app, so it rejects made-up prompts and answers. As a
result, a content fix needs a Worker redeploy in the same pipeline (see Consequences). The raw `input` of a timed-out
round is **not** sent, because the player never submitted it.

**`GET /stats/:date`** returns the final shares for a day that has **closed**. It returns `403 { "error":
"day_in_progress" }` while the day, or its grace period, is still open.

```jsonc
{
  "date": "2026-10-30",
  "final": true,
  "prompts": [ { "promptId": "…", "plays": 980, "misses": 51, "answers": [ { "name": "…", "count": 0, "share": 0 } ] } ]
}
```

A closed day never changes, so the response carries `Cache-Control: public, max-age=86400` and can be cached at the
edge. This feeds the archive (roadmap step 3) and the tier recomputation.

**Anti-cheat stance.** Today's shares come back only in the `POST` response for a prompt the device has just
played. This is a **deterrent, not security**: someone can mint a device id and post a junk miss to peek at a prompt.
That isn't worth hardening, because the answers and editorial tiers ship in the bundle anyway, as they did for
Wordle, and still will per day after #18.

### Schema (D1 / SQLite)

The full file, with comments, is [`prototypes/answer-stats/schema.sql`](../../prototypes/answer-stats/schema.sql).

```sql
-- Raw rows, one per device per prompt per day. The primary key IS the dedupe rule. Deleted once the day closes.
CREATE TABLE submissions (
  date TEXT NOT NULL, prompt_id TEXT NOT NULL,
  device_hash TEXT NOT NULL,              -- HMAC-SHA256(secret, date || ':' || deviceId), 128 bits hex
  answer_key TEXT NOT NULL,               -- normalize(canonical name); '' = miss
  created_at INTEGER NOT NULL,
  PRIMARY KEY (date, prompt_id, device_hash)
) WITHOUT ROWID;

CREATE TABLE guesses (
  date TEXT NOT NULL, prompt_id TEXT NOT NULL, device_hash TEXT NOT NULL,
  guess_key TEXT NOT NULL,                -- normalize(guess)
  guess_text TEXT NOT NULL,               -- trimmed, at most 40 chars, scrubbed
  PRIMARY KEY (date, prompt_id, device_hash, guess_key)
) WITHOUT ROWID;

-- Aggregates with no device data, maintained by triggers in the same transaction as the raw insert
CREATE TABLE answer_counts (date TEXT, prompt_id TEXT, answer_key TEXT, count INTEGER,
                            PRIMARY KEY (date, prompt_id, answer_key)) WITHOUT ROWID;   -- kept indefinitely
CREATE TABLE guess_counts  (date TEXT, prompt_id TEXT, guess_key TEXT, guess_text TEXT, devices INTEGER,
                            PRIMARY KEY (date, prompt_id, guess_key)) WITHOUT ROWID;    -- kept 30 days

CREATE TRIGGER count_submission AFTER INSERT ON submissions BEGIN
  INSERT INTO answer_counts VALUES (NEW.date, NEW.prompt_id, NEW.answer_key, 1)
  ON CONFLICT (date, prompt_id, answer_key) DO UPDATE SET count = count + 1;
END;
-- count_guess does the same for guess_counts; review_queue is a view (below)
```

Answers are keyed by `normalize(name)`, not by display name, so a casing or punctuation fix doesn't orphan the
counts. A real rename still does. See Open questions.

Reads stay cheap. A `POST` reads that prompt's rows in `answer_counts`, a few dozen at most, rather than counting
submissions.

### Abuse without accounts

| Threat | Control |
|---|---|
| Replaying a round, or changing your answer | `INSERT OR IGNORE` on `(date, prompt_id, device_hash)`: **the first submission per device per prompt per day counts**. Guesses are stored only with that first submission |
| Late or early submissions | Accepted only for today (Singapore time), and for yesterday until **00:30 SGT**, so a dive in progress at midnight can finish. Future dates get 400; older dates get 410. The app lets a dive that spans midnight be finished at any time; rounds finished after the grace period are simply not counted, and the client ignores the 410 |
| Scripted floods | The Rate Limiting binding, keyed by client IP, allows **60 requests/min per IP per location**. A dive is only 7 requests; the headroom is for shared IPs (mobile CGNAT, school wifi). The IP is used in memory and never stored |
| Junk content | The prompt must be scheduled for that date and the answer must be one of its canonical names (422 otherwise). At most 10 attempts are read, each at most 40 characters |
| Stuffing the review queue | The queue needs at least 5 distinct device hashes **and** at least 1% of plays, and a human reviews every item |
| Poisoning shares or tiers | Shares are cosmetic. Tiers change only through a human-reviewed content PR, never live. **Escalation if needed:** Cloudflare Turnstile on a day's first POST, or a per-IP daily cap using a daily-salted IP hash kept only for the open day. Both cost privacy or friction, so neither is built until there's a real problem |

### Recomputing tiers

The recomputation runs **offline**: a script, e.g. weekly, pulls `SUM(count)` per `(prompt_id, answer_key)` across
every daily serving of a prompt (Unlimited is never counted), runs `recomputeTiers()`, and opens a content PR for
a human to review. Live scores never change mid-day, so the fairness rule holds. The function lives in
[`prototypes/answer-stats/src/tiers.ts`](../../prototypes/answer-stats/src/tiers.ts) and is pure, so it can move to
`src/game/` as is.

**Denominator.** `plays` counts every daily play of the prompt, **misses included**. That makes the share the same
number the reveal shows ("X% of players found this").

**Prior.** Each editorial tier has a weight: `common 8, trap 4, solid 3, rare 1, ulu 0.3, gem 0.3`. An answer's
prior share is

```
prior(a)     = hitRate × w(tier(a)) / Σ w(all answers)        hitRate = 1 − misses / plays
posterior(a) = (count(a) + W × prior(a)) / (plays + W)        W = 100 pseudo-plays
```

Below **100 plays** (`minPlays`), the editorial tiers are returned unchanged. Above it, the prior weighs as much as
100 extra plays, so it fades as data comes in.

**Thresholds on the posterior share** (they replace the "top 10% of answers by share" idea in ARCHITECTURE.md; a
rank-based cut would force some answers to `common` even on a flat prompt):

| Posterior share | Suggested tier |
|---|---|
| ≥ 10% | `common` |
| 3% – 10% | `solid` |
| 1% – 3% | `rare` |
| < 1% | `ulu` |

**Traps.** An answer listed as `trap`, `rare` or `ulu` (meant to be obscure) whose posterior share is **≥ 3%**
becomes `trap`. An editorial `trap` below 3% falls back to the table: it wasn't a trap after all.

**Invariants**, so suggestions still pass `npm run validate`:

- The **gem never moves.** It is hand-picked for fun, and validation needs exactly one per prompt. A gem with a
  posterior of 3% or more is flagged `gem-too-popular` so a human can pick another.
- At least **3 easy answers** (`common`/`trap`/`solid`). If the data leaves fewer, the most-picked non-easy answers
  are lifted to `solid` and flagged `promoted-for-easy-minimum`.

**Worked example.** This is the unit test in `test/tiers.test.ts`. A prompt has 12 answers (3 common, 1 trap,
3 solid, 3 rare, 1 ulu, 1 gem), 500 plays and 50 misses, so `hitRate` is 0.9 and `Σw` is 40.6. The prior shares
are: common 17.73%, trap 8.87%, solid 6.65%, rare 2.22%, ulu and gem 0.67%.

| Answer | Editorial | Count | Raw share | Posterior | Suggested |
|---|---|---|---|---|---|
| A | common | 128 | 25.6% | (128 + 17.73) / 600 = 24.29% | common |
| B | common | 90 | 18.0% | 17.96% | common |
| C | common | 10 | 2.0% | (10 + 17.73) / 600 = 4.62% | **solid** (fewer said it than we thought) |
| T | trap | 40 | 8.0% | 8.14% | trap (confirmed) |
| D | solid | 50 | 10.0% | 9.44% | solid (the prior keeps it just under 10%) |
| E | solid | 30 | 6.0% | 6.11% | solid |
| F | solid | 2 | 0.4% | 1.44% | **rare** |
| R1 | rare | 45 | 9.0% | (45 + 2.22) / 600 = 7.87% | **trap**, detected automatically |
| R2 | rare | 12 | 2.4% | 2.37% | rare |
| R3 | rare | 3 | 0.6% | 0.87% | **ulu** |
| U | ulu | 0 | 0% | 0.11% | ulu |
| G | gem | 40 | 8.0% | 6.78% | gem, flagged `gem-too-popular` |

### UI: "X% of players found this"

This is a later change to the client; the spike doesn't touch `src/`. When a **daily** round ends, the client
sends `POST /answers` in the background, with a timeout of about 3 s. The Reveal shows one extra line in the
verdict card when the response arrives. If the request fails, times out or returns 410, the line simply doesn't
appear. Nothing waits on it, and the round is already locked, so it can't be used to change an answer.

```
┌──────────────────────────────────────────────┐
│ 🔵  Steady                              +60  │
│     one-north                                │
│     Genuinely uncommon. Steady pom pi pi.    │
│     ──────────────────────────────────────   │
│     4% of players found this so far today    │   ← new, daily only
└──────────────────────────────────────────────┘
  💎 The gem   Bras Basah
```

| Case | Copy |
|---|---|
| plays ≥ 20 | "**4%** of players found this so far today". Under 1% shows "**Under 1%** …", never "0%" |
| plays < 20 | "You're one of the first 12 divers on this prompt today" |
| Miss | "**9%** of players missed this one too" |
| Unlimited, or no response | No line |

Use `aria-live="polite"` on the line so screen readers hear it when it arrives. The results screen and the
archive can show the final numbers later from `GET /stats/:date`.

### Review queue for unrecognised guesses

Rejected guesses (`attempts`) are normalised with the app's `normalize()`, scrubbed, and counted once per device.
A guess enters the queue when, over the last 30 days, **at least 5 distinct devices** typed it for the same
prompt **and** they make up **at least 1% of that prompt's plays** in that window. This is the `review_queue` view in
`schema.sql`. A reviewer then adds the guess as an answer or alias through a normal content PR, or dismisses it.
This replaces the manual form planned in #9 for the common case, "lots of people typed this". The "Should this
count?" link from #9 is still useful for one-off reports with a reason (see Open questions).

Scrubbing drops a guess that's over 40 characters, contains `@`, `http` or `www.`, contains a phone-number-like run of 8 or
more digits, spaces or dashes, matches the NRIC/FIN pattern, or already matches a known answer or alias.

### Privacy (PDPA)

*This is engineering practice, not legal advice. Items marked ⚑ need a human check.*

**What's stored**

| Data | Where | Kept for |
|---|---|---|
| `device_hash`: HMAC of a random per-day id and the date | `submissions`, `guesses` | Until the day closes. The 00:45 SGT cron deletes it, so about a day |
| Answer per prompt per day (`answer_key`) | `submissions` (raw), `answer_counts` (totals) | Raw: about a day. Totals: indefinitely; they're counts with nothing about a person |
| Rejected guesses (scrubbed text) | `guesses` (raw), `guess_counts` (totals) | Raw: about a day. Totals: 30 days, or until a reviewer copies an item into a content PR |
| IP address | Memory only, as the rate-limit key | Not stored by our code. ⚑ Check what Cloudflare's own request logs and Workers observability keep, and turn off what we don't need |

There are no names, emails, accounts, cookies, ad trackers or fingerprinting.

**Device id.** The client makes a fresh `crypto.randomUUID()` **each Singapore day** and stores it with that day's
progress (`ulu:daily`), so it's discarded when the next dive starts. Dedupe is per day, so a long-lived id adds
nothing, and a per-day id can't link one player's dives. The server stores only an HMAC of `date:deviceId`, keyed
by a Worker secret, never the raw id. (The alternative is one id kept in `localStorage` until the player clears it.
It's simpler but long-lived, and nothing here needs it.)

**Draft notice**, for How to play or a footer link (⚑ needs review):

> **Anonymous stats.** When you finish a round of the daily dive, Ulu sends the date, the prompt, the answer you got
> (or that you missed) and any guesses that weren't accepted, together with a random code your browser makes fresh
> each day. We use this only to count each player once and to show what share of players found each answer. We don't
> ask for your name, email or an account, and we don't use cookies or ad trackers. The daily code is deleted after
> about a day; we keep only totals, like "412 players, 37 missed". Guesses that weren't accepted are kept for up to
> 30 days so we can add missing answers. Please don't type personal information into the answer box. Unlimited games
> are never sent. Questions: \<contact\>.

**⚑ For a human to check**

1. Whether the per-day device hash plus a transient IP counts as personal data under the PDPA. If it does,
   the consent, notification, purpose limitation, retention limitation and protection obligations apply.
2. **Transfer limitation.** D1's primary can't be pinned to Singapore (`apac` hint only). Decide whether this matters
   for data designed to be anonymous; Supabase in `ap-southeast-1` avoids the question.
3. Who the "organisation" is for a hobby project, whether a Data Protection Officer contact must be published, and
   what goes in \<contact\>.
4. The provider's data processing terms (Cloudflare or Supabase), and log retention defaults.
5. Players may be under 18. Check whether PDPC's guidance on children's data changes the notice or the defaults.

## Consequences

- **Content and the API ship together.** The Worker validates against the bundled packs and schedule. A content PR
  that adds an answer must redeploy the Worker in the same pipeline, or that answer gets 422 until it does. After #18,
  the Worker can read the same per-day file the client loads.
- **The Worker only knows scheduled days.** The app falls back to seeded prompts for a date missing from
  `schedule.json`. The Worker checks only the schedule, so if the schedule ever lapsed, every POST would get 422.
  CI guards the runway; a production Worker could call `promptsForDate()` from `src/game/schedule.ts` instead.
- **Two things can disagree for a while.** The reveal may say "Damn Ulu" while 12% of players found it. That gap is
  exactly what the tier PR fixes, and it is visible to players in the meantime.
- **Tiers stay editorial in the data model.** The packs remain the source of truth. Data produces suggestions that
  go through review, and `npm run validate` still guards every prompt.
- **New moving parts:** a secret (`DEVICE_HASH_SECRET`), a cron, a D1 database to back up, and CORS if the site
  isn't on Cloudflare. CI would need a deploy step with a scoped API token.
- **Stats are best effort.** A cleared browser or a determined script can add plays. That's acceptable for cosmetic
  shares and human-reviewed tiers, and not acceptable for verified leaderboards, which would need accounts.
- The prototype is a throwaway. Productionising means integration tests against D1, an atomic guesses insert,
  migrations and monitoring.

## Open questions for the team

1. **Hosting:** confirm A (Cloudflare) or B (Supabase), together with #3. If Pages wins #3, put the API same-origin
   under `/api`.
2. **Data residency:** is "D1 primary somewhere in APAC" acceptable, or must data stay in Singapore (which points
   to B)?
3. **Answer ids:** should `Answer` get a stable `id`, so renaming a canonical answer doesn't orphan its counts?
   This touches the content schema and validation.
4. **Tier parameters:** are `W = 100`, `minPlays = 100`, the 10/3/1% thresholds and the 3% trap line right?
   Should there be hysteresis, e.g. ±20%, so answers near a boundary don't flip every week?
5. **Grace period:** 30 minutes after midnight, or longer?
6. **Rate limit:** is 60 requests/min per IP right for CGNAT and schools? Measure once live.
7. **#9's report link:** keep it as a GitHub form for reasoned reports, or post it to the API as a stronger signal
   in the queue?
8. **Who reviews the queue and the tier PRs, and how often** (this ties into the triage TODO in CONTRIBUTING.md)?
9. **Privacy:** the ⚑ items above, the final notice text and the contact address.
