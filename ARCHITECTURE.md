# Ulu architecture

Ulu is a Singapore-flavoured take on [Krillion](https://krillion.io): a daily word-recall game where the
**rarest valid answer wins**. "Ulu" is Singlish for remote or out-of-the-way, which is the point of the game:
go somewhere nobody else thought of.

## Game design

| | |
|---|---|
| Daily dive | 7 prompts, same for everyone, resets at midnight **Singapore time** |
| Per prompt | 25 seconds, one free-text answer. Unrecognised input can be retried while the clock runs; the first valid answer locks in |
| Scoring | Each accepted answer has a rarity tier (below). Timeout = 0 |
| Max | 7 × 100 = 700 |
| Theme | The score is a journey out of town: Raffles Place → Bishan → Sengkang → Woodlands → Lim Chu Kang → Pulau Ubin → Pulau Tekong → Pedra Branca (700) |
| Unlimited | 7 random prompts from past dives (never today's), no stats, replay as often as you like. Back-to-back games don't share prompts. While the archive is too small to fill a game, it uses the rest of the bank |
| Reveal | The verdict, the gem, up to 3 other answers per tier, and every accepted answer behind a "Show all N answers" disclosure, grouped by tier from the gem down. The results screen has the same disclosure for each prompt |
| Sharing | Spoiler-free emoji grid: `Ulu #3 🇸🇬 410/700 / 💎🟢⚪🔵❌🟣🟡 / Reached Lim Chu Kang` |

| Tier | Label | Points | Meaning |
|---|---|---|---|
| `common` | Everybody Say | 10 | The first thing everyone blurts out |
| `trap` | Act Smart | 15 | The "obscure" pick that everyone actually reaches for |
| `solid` | Can Lah | 30 | Well known, not the first thing said |
| `rare` | Steady | 60 | Genuinely uncommon |
| `ulu` | Damn Ulu | 85 | Deep cut |
| `gem` | Sibei Ulu | 100 | One hand-picked, delightful deep cut per prompt |

## Stack

A static single-page app: **Vite + React + TypeScript**, no backend. It can be hosted on any static host
(Vercel, Netlify, GitHub Pages, Cloudflare Pages).

```
src/
  game/              pure logic, no React; unit tested
    types.ts         Prompt / Answer / Tier / Category schema
    normalize.ts     answer → comparison key
    match.ts         exact + typo-tolerant matching
    scoring.ts       tier points, labels, destinations
    daily.ts         Singapore date, seeded daily selection, unlimited shuffle
    schedule.ts      frozen daily schedule: lookup, append-only extension, checks, unlimited pool
    storage.ts       localStorage progress + stats (fails safe)
    share.ts         share text
    report.ts        answer report links (VITE_REPORT_URL or the GitHub issue form)
    validate.ts      content rules, shared by tests and scripts
  content/
    packs/*.json     the question bank, one pack per category
    schedule.json    which prompts run on which day
    index.ts         loads every pack at build time
  components/        Game, Round, Reveal, Results, AllAnswers, Report, HowToPlay, RouteLine, Countdown,
                     PrivacyNote
  analytics.ts       optional cookie-less analytics: track(), score bands, script loader
  App.tsx            screen routing (home / daily / unlimited / results)
scripts/
  validate-content.ts   npm run validate
  schedule.ts           npm run schedule  (extend the daily schedule)
  draft-prompt.ts       npm run draft  (Claude-assisted drafting, offline)
  site-meta.ts          Vite plugin: absolute link-preview tags from VITE_SITE_URL
design/                 SVG sources for the share image and the iOS icon, rendered into public/
```

## How questions are created

Questions are **curated data, not generated at runtime**. A prompt is a JSON object:

```json
{
  "id": "transport-ccl-stations",
  "category": "transport",
  "text": "Name a station on the Circle Line",
  "note": "As of October 2026",
  "answers": [
    { "name": "Dhoby Ghaut", "tier": "common" },
    { "name": "HarbourFront", "aliases": ["Harbour Front"], "tier": "common" },
    { "name": "one-north", "aliases": ["One North"], "tier": "rare" },
    { "name": "Bras Basah", "tier": "gem" }
  ]
}
```

Pipeline:

1. **Draft.** Write by hand, or run `npm run draft -- --category food "Name a kueh"`. The draft script asks
   Claude (`claude-opus-5-5`, structured output) for a full answer list with tiers and aliases, and writes it to
   `content/drafts/` along with notes for the reviewer. Nothing it produces goes live automatically.
2. **Review.** A human checks every answer for correctness, completeness (unrecognised = 0 points, so gaps
   are frustrating), tier calibration and the gem choice. Time-sensitive sets (new MRT stations, office holders)
   get a `note` with an as-of date.
3. **Validate.** `npm run validate` (also run in `npm test`) enforces: unique kebab-case ids, known
   category, ≥ 12 answers, ≥ 3 easy (common/trap/solid) answers, exactly one gem, and that no two answers share
   a normalised name or alias, which would make matching ambiguous.
4. **Ship.** Move the prompt into `src/content/packs/<category>.json`. It is bundled at build time.

Prompts favour **closed, verifiable sets** (stations on a line, Presidents, HDB towns) because they can be
complete. Open sets (hawker dishes, Singlish words) carry long answer lists with spelling variants.

### How rarity is decided (now and later)

- **Now: editorial.** Tiers reflect how likely a typical Singapore resident is to think of an answer, judged by
  the writer and reviewer with LLM help. The gem is chosen for rarity *and* fun.
- **Later: data-driven.** Once there is a backend, log every accepted answer per prompt (anonymous counts only)
  and recompute tiers from real frequency, e.g. top 10% of answers by share = `common`, under 1% = `ulu`.
  Editorial tiers then become the cold-start prior, and `trap` can be detected automatically as "listed
  as rare but heavily picked". Unrecognised inputs that many players type are a review queue for missing
  answers.
- **Until then: player reports.** Every rejected guess is kept on the round result (`attempts`, deduplicated
  by normalised text). The reveal and the results screen list them with a "Should this count?" link, and each
  prompt on the results screen can be reported as having a wrong answer or a tier that feels off. The links
  open a form prefilled with the dive date (`unlimited` for Unlimited), prompt id and guesses: the player form
  set at build time with `VITE_REPORT_URL`, or the GitHub issue form `answer-report.yml` without it (see
  [CONTRIBUTING.md](CONTRIBUTING.md#answer-reports-from-players)). None of this goes in the share text.

## Answer matching

`normalize()` lower-cases, strips accents, punctuation, spaces and a leading "the", and turns `&` into
"and", so `Char Kway Teow`, `char-kway-teow` and `charkwayteow` are equal. `matchAnswer()` tries exact
matches on names and aliases first. If none match, it allows 1 typo for 5–9 character keys and 2 for longer
ones, and accepts the correction only when a **single** answer is closest. Short inputs (under 5 characters)
must match exactly, so `Bedk` won't become `Bedok` and abbreviations like `AMK` stay precise.

## Daily selection

- The date key is today's date in `Asia/Singapore`, independent of the device timezone.
- Each day's prompt ids are **frozen** in `src/content/schedule.json` (`{ "2026-10-27": ["id", …], … }`). The
  file only grows, so adding, editing or reordering prompts never changes a day that's already scheduled.
- `npm run schedule -- --days 30` appends days until the schedule reaches 30 days past today (30 is the default). Each new day takes
  the least recently used prompt from each of 7 different categories, so a prompt rests as long as the bank
  allows before it comes back. With ~8–10 prompts per category that's about 8 days. **Growing the bank is the
  main lever for longevity.** New prompts only appear on days scheduled after they were added, which is why
  the schedule runs a month ahead and not further.
- `npm test` and `npm run validate` check the schedule. For every day: each scheduled id still exists (so a
  prompt can't be deleted or renamed once it's scheduled), it has 7 different prompts, and there are no gaps.
  For days after today, which are the only ones that can still change: no prompt repeats within 7 days
  (`MIN_REPEAT_GAP`, raise it as the bank grows; past days still count as history), and each day uses 7
  categories. The schedule must also reach at least 14 days past today. When that last check fails, run
  `npm run schedule` and commit the result. `npm run schedule` runs the same checks and leaves the file alone if
  they fail.
- CI also runs daily on a cron, because the 14-day check depends on the date: a quiet repo still goes red two
  weeks before the schedule runs out.
- If a date is missing from the schedule, the game falls back to the original seeded selection: a seeded PRNG
  (FNV-1a hash → mulberry32) shuffles the categories for the date, and each category walks its own shuffled
  order one step per day. The days before the schedule existed (27–30 Oct 2026) were backfilled with it. If the
  schedule ever lapses, `npm run schedule` backfills the missed days the same way, since that's what players
  got. Those days can repeat prompts early, which is why the repeat check skips past days: they can't be edited,
  and checking them would keep validation red for good.
- The chosen prompt ids are also saved with the player's progress, so a content deploy mid-day doesn't swap
  prompts under someone who has already started.

## Fairness & persistence

- Progress (prompt ids, results and the start time of the current round) is stored in `localStorage` after
  every round start and end. Reloading mid-round resumes with the **same deadline**, so you can't refresh to
  peek at a prompt and reset the clock.
- Progress saved by a build from before rejected guesses were kept has no `attempts`; `loadDaily` fills in `[]`,
  so it still loads and resumes.
- Stats (played, streak, best, gems) update once per Singapore day, as soon as the last answer is saved, so
  leaving or reloading before the results screen still counts the dive. The shown streak drops to 0 once a whole
  day passes without a dive.
- The home screen moves to the new dive at Singapore midnight, and checks the date again whenever the tab comes
  back into view (phones often keep a tab open overnight). A dive in progress at midnight can still be finished:
  it keeps its prompts and counts toward the date it started on.
- With two tabs open across midnight, finishing the older dive last can't rewind the stats or overwrite the
  newer dive's progress: storage ignores a dive older than the last one recorded or saved.
- All storage access is wrapped; private browsing just means nothing is remembered.
- Answers ship in the client bundle. This is fine for a casual daily game (Wordle did the same); a backend
  would be needed for verified leaderboards.

## Analytics

Analytics is optional and off unless the production build sets the `VITE_ANALYTICS_*` variables (listed in the
README). `src/analytics.ts` is provider-agnostic: `track(event, props?)` calls Plausible's
`window.plausible(name, { props })` or Umami's `window.umami.track(name, data)`, and `loadAnalytics()` (from
`main.tsx`) adds the provider's script. Both do nothing on the dev server, without the variables, or on any
host other than `VITE_ANALYTICS_DOMAIN`. The script is added at runtime, after that host check, so a preview
deploy built with production settings doesn't even send page views. `track()` never throws.

Events are listed in the README's Privacy section. The rules: no typed answers, no prompt ids, no personal
data, and only coarse properties (a 100-point score band, share vs copy). Answer logging for data-driven tiers
is a separate, backend job (roadmap step 2). `dive_completed` fires where the dive reaches the stats
(`recordDaily` in `App.tsx`), and only when `recordDive` actually counted it, once per session per date, so
seeing the results, a reload or blocked storage can't count a dive twice.

**Choosing a tool** (the team's call, tied to the host):

| | Cloudflare Web Analytics | Plausible | Umami |
|---|---|---|---|
| Cookie-less, no consent banner | Yes | Yes | Yes |
| Custom events with properties | **No**: page views and Web Vitals only | Yes | Yes |
| Cost | Free | Paid cloud plans; free to self-host (AGPL) | Free cloud tier for small sites; free to self-host (MIT) |
| Self-hosting needs | n/a | A server with Postgres and ClickHouse | A server with Postgres (or MySQL) |
| Works with `src/analytics.ts` | No | Yes | Yes |

Cloudflare's tool can't record the events this game needs, so it's out as the only tool, though it could
still sit alongside for page views if we host on Cloudflare. **Recommendation: Umami Cloud's free tier** to
start, because it covers the events at no cost and with no server to run; move to Plausible (or self-hosted
Umami) if we outgrow it or want EU-hosted data. Switching is a change of environment variables, not code.
Check current pricing and limits before deciding.

One limit of any cookie-less tool: it can't follow a visitor across days, so "do people come back" has to be
read from daily totals (daily visitors against `dive_started` and `dive_completed`) rather than per-person
retention.

## Roadmap

1. Host it (static) and add basic privacy-friendly analytics.
2. A small backend (e.g. Supabase or Cloudflare Workers + D1) for anonymous answer logging, then
   frequency-based tiers and "X% of players found this" on the reveal.
3. Archive of past dives (read from the schedule), themed packs, friends leaderboards.
4. A party mode: same prompts, live room, rarest answer *within the room* wins.
