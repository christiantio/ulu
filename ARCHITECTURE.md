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
| Unlimited | 7 random prompts, no stats, replay as often as you like |
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
    storage.ts       localStorage progress + stats (fails safe)
    share.ts         share text
    validate.ts      content rules, shared by tests and scripts
  content/
    packs/*.json     the question bank, one pack per category
    index.ts         loads every pack at build time
  components/        Game, Round, Reveal, Results, HowToPlay, RouteLine, Countdown
  App.tsx            screen routing (home / daily / unlimited / results)
scripts/
  validate-content.ts   npm run validate
  draft-prompt.ts       npm run draft  (Claude-assisted drafting, offline)
```

## How questions are created

Questions are **curated data, not generated at runtime**. A prompt is a JSON object:

```json
{
  "id": "circle-line-stations",
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

## Answer matching

`normalize()` lower-cases, strips accents, punctuation, spaces and a leading "the", and turns `&` into
"and", so `Char Kway Teow`, `char-kway-teow` and `charkwayteow` are equal. `matchAnswer()` tries exact
matches on names and aliases first. If none match, it allows 1 typo for 5–9 character keys and 2 for longer
ones, and accepts the correction only when a **single** answer is closest. Short inputs (under 5 characters)
must match exactly, so `Bedk` won't become `Bedok` and abbreviations like `AMK` stay precise.

## Daily selection

- The date key is today's date in `Asia/Singapore`, independent of the device timezone.
- A seeded PRNG (FNV-1a hash → mulberry32) shuffles the categories for that date. Each dive takes one prompt
  from each of 7 different categories.
- Every category has its own fixed shuffled order and advances one step per day, so a prompt only repeats after
  its whole category has cycled. With ~8–10 prompts per category, that is roughly a week and a half of
  fresh dives. **Growing the bank is the main lever for longevity.**
- The chosen prompt ids are saved with the player's progress, so a content deploy mid-day doesn't swap prompts
  under someone who has already started.
- Known limitation: adding prompts to a category reshuffles its future order. Past dives aren't stored, so this
  only matters once there is an archive. At that point, freeze schedules into a generated `schedule.json`.

## Fairness & persistence

- Progress (prompt ids, results and the start time of the current round) is stored in `localStorage` after
  every round start and end. Reloading mid-round resumes with the **same deadline**, so you can't refresh to
  peek at a prompt and reset the clock.
- Stats (played, streak, best, gems) update once per Singapore day.
- All storage access is wrapped; private browsing just means nothing is remembered.
- Answers ship in the client bundle. This is fine for a casual daily game (Wordle did the same); a backend
  would be needed for verified leaderboards.

## Roadmap

1. Host it (static) and add basic privacy-friendly analytics.
2. A small backend (e.g. Supabase or Cloudflare Workers + D1) for anonymous answer logging, then
   frequency-based tiers and "X% of players found this" on the reveal.
3. Archive of past dives (needs a frozen schedule), themed packs, friends leaderboards.
4. A party mode: same prompts, live room, rarest answer *within the room* wins.
