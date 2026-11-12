# Ulu architecture

Ulu is a Singapore-flavoured take on [Krillion](https://krillion.io): a daily word-recall game where the
**rarest valid answer wins**. "Ulu" is Singlish for remote or out-of-the-way, which is the point of the game:
go somewhere nobody else thought of.

## Game design

| | |
|---|---|
| Daily dive | 7 prompts, same for everyone, resets at midnight **Singapore time** |
| Mix | Mostly Singapore prompts, with up to 2 world prompts (general knowledge) a day once the bank has enough of them. See [Daily selection](#daily-selection) |
| Per prompt | 25 seconds, one free-text answer, and the lift's doors close as the time runs down. Unrecognised input can be retried while the clock runs; the first valid answer locks in. When time runs out, whatever is in the answer box is judged as if it had been entered, so an answer typed in time isn't lost to a late press of Go. A known wrong answer (a decoy) is refused with its reason, and a guess that fits several answers asks for more |
| Scoring | Each accepted answer has a rarity tier (below), and the dive's score is the sum. Timeout = 0. Nothing ever scores below zero |
| Max | 7 × 100 = 700 |
| Theme | Answers climb floors while the cumulative score unlocks lifts, from the HDB lift to the sky penthouse |
| Unlimited | 7 random prompts from past dives (never today's), no stats, replay as often as you like. Back-to-back games don't share prompts. While the archive is too small to fill a game, it uses the rest of the bank |
| Answer animation | After each answer, a ride out of town on the "Ulu Line", whose stations are the tiers in order (Everybody Say → Act Smart → Can Lah → Steady → Damn Ulu → Sibei Ulu). The train passes every station below the answer's tier, slowing at each as if it might stop, and stops at its own. The MRT ends on the shore at Changi Point: for Damn Ulu and Sibei Ulu, the train stops there, you hop into the bumboat waiting at the jetty, and it takes you on to Pulau Ubin or the Pedra Branca lighthouse. A miss is the train leaving without you. It takes 2.4–7.1 s, the pips, score and route only update when it lands, and Skip (or a tap on the scene) jumps to the reveal. With `prefers-reduced-motion`, it's skipped |
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
    types.ts         Prompt / Answer / Decoy / Tier / Category schema, and each category's scope (sg or world)
    normalize.ts     answer → comparison key, and its loose form (filler, numbers, short forms)
    match.ts         what a guess means: exact, loose, part of a name, typo; decoys and ambiguous guesses
    scoring.ts       tier points, labels, destinations
    elevator.ts      floors, lift upgrades and the answer animation's timing and motion
    daily.ts         Singapore date, seeded daily selection, unlimited shuffle
    schedule.ts      frozen daily schedule: lookup, append-only extension, checks, unlimited pool
    storage.ts       localStorage progress + stats (fails safe)
    share.ts         share text
    report.ts        answer report links (VITE_REPORT_URL or the GitHub issue form)
    validate.ts      content rules, shared by tests and scripts
  content/
    packs/*.json     the question bank, one pack per category
    schedule.json    which prompts run on which day
    index.ts         loadDive(date): fetches dives/<date>.json, falls back to the bank
    bank.ts          every pack plus the schedule, a lazily loaded chunk (see "Loading content" below)
    bank-loader.ts   loadBank(): the dynamic import of bank.ts
  components/        Game, Round, Reveal, Results, AllAnswers, Report, HowToPlay, ElevatorProgress,
                     Countdown, CountUp, KeyHint, PrivacyNote, elevator/ElevatorScene
  analytics.ts       optional cookie-less analytics: track(), score bands, script loader
  viewport.ts        the visible height of the page, for fitting a question above a phone's keyboard
  haptics.ts         a short buzz on phones that can: answer locked in, answer refused, time up
  App.tsx            screen routing (home / daily / unlimited / results), loading today's dive
  test/dives.ts      test helper: a fetch stub that serves the dive files
  test/motion.ts     test helper: a matchMedia stub for prefers-reduced-motion
scripts/
  validate-content.ts   npm run validate
  schedule.ts           npm run schedule  (extend the daily schedule)
  ideas.ts              npm run ideas  (Claude proposes prompts to write, offline)
  draft-prompt.ts       npm run draft  (Claude drafts one prompt for review, offline)
  generate/             the pipeline behind both: brief.ts (every prompt sent to Claude), schemas.ts,
                        llm.ts (the API calls), tiers.ts (estimates → tiers), pipeline.ts (the stages)
  site-meta.ts          Vite plugin: absolute link-preview tags from VITE_SITE_URL
  dives.ts              Vite plugin: one dives/<date>.json per scheduled day, built and served in dev
  check-bundle.ts       npm run check:bundle  (entry size budget, no question data in the entry)
design/                 SVG sources for the share image and the iOS icon, rendered into public/
```

### Loading content

The first visit downloads the app and today's prompts, and nothing else. The question bank and the schedule
stay out of the entry chunk:

| What | Where it comes from | When it loads |
|---|---|---|
| The app (entry chunk) | `dist/assets/index-<hash>.js` | First load. About 296 kB, 95 kB gzipped |
| Today's prompts | `dist/dives/<date>.json`, the day's 7 full prompts in schedule order | First load, and again when the date rolls over. About 23–35 kB, 6–7 kB gzipped |
| The bank (every pack plus `schedule.json`) | `dist/assets/bank-<hash>.js`, from `import('./bank')` | Only when Unlimited starts, when a date has no dive file, or when saved progress names prompts the day's file doesn't have. About 227 kB, 53 kB gzipped |

- **The dive files.** `scripts/dives.ts` is a Vite plugin. At build time it emits `dives/<date>.json` for every
  date in the schedule. In dev, middleware serves the same files from the current packs, so edits show up
  without a restart, and answers a date that isn't scheduled with a 404. `vite preview` serves them from
  `dist/` like any other file. The app fetches `${BASE_URL}dives/<date>.json`, so it works under a sub-path
  base too.
- **Today's dive on home.** The home card shows "Loading today's dive…" (`role="status"`, with `aria-busy` on
  the card) until the file arrives. If the request fails (offline, or a server error), the card shows an error
  with a **Retry** button instead. It doesn't download the bank in that case. A finished dive's score still
  shows while the file loads, because it comes from `localStorage`. When the date rolls over, home fetches the
  new day's file. A reply for a date that has already passed is ignored.
- **A dive in progress keeps the prompts it started with.** They're stored in the screen state when the dive
  starts, so a dive started before midnight finishes, and shows its results, with the prompts from the file it
  loaded. It never needs a second fetch.
- **Results.** `Results` gets the dive's prompts as a prop, whether that's the daily or an Unlimited set,
  instead of looking them up in a global bank.
- **A missing day.** A 404, or a 200 that isn't a dive file (some hosts, `vite preview` included, answer
  unknown paths with `index.html`), loads the bank and uses `promptsForDate`. That gives the scheduled prompts
  if the bank's schedule has the date, and the seeded fallback if not.
- **Unlimited.** Unlimited downloads the bank the first time it starts, with a "Loading Unlimited…" screen
  and Retry if that fails. After that it keeps the bank, so "Play again" starts at once. Today's prompts are
  excluded using both the saved progress and the bank's schedule, so the exclusion holds even when today's
  file didn't load.
- **The size check.** `npm run check:bundle` runs after `npm run build`, locally and in CI. It fails if the
  entry JS (the module script plus anything `index.html` preloads) is over budget: 300 kB raw, 95 kB gzipped,
  set in `ENTRY_BUDGET`. It also fails if any prompt id, prompt text or gem name appears in the entry. Strings
  the app's own source also uses (for example "ulu") can't tell anything, so they're skipped and listed. Last,
  every scheduled date must have its dive file, matching the schedule. Before this change the entry was
  482.5 kB (129.4 kB gzipped) with the whole bank inside, and the check fails on it.
- **Spoilers.** This keeps answers out of the first load, but it doesn't hide them. Future days' files sit in
  `dist/dives/` under guessable names. The bank chunk, whose URL is in the entry chunk, holds every prompt,
  every answer and the whole schedule. Non-guessable dive file names (a content hash plus a manifest) would add
  complexity and hide nothing. The manifest would have to list future names, and the bank already gives the
  schedule away. Really hiding future days needs a server that only releases a day's file once that day has
  started.
- **Caching.** Dive files keep the same name when a content fix changes a day's answers, so a host that
  caches `/dives/*` for a long time would delay the fix. Use the host's default (revalidate) for that path. The
  hashed `assets/` files can be cached forever.

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

1. **Draft.** Write by hand, or run `npm run draft -- --category food "Name a kueh"` (and `npm run ideas` for
   what to write about). The draft script runs four separate Claude calls (`claude-opus-5-5`, structured
   output): one compiles the answers, aliases and decoys, one fact-checks that list with web search, and three
   estimate what different groups of players would type, which plain code turns into tiers. The draft and the
   evidence behind it go to `content/drafts/`. Nothing it produces goes live automatically, and the game never
   calls the API. The design is in [docs/question-pipeline.md](docs/question-pipeline.md).
2. **Review.** A human checks every answer for correctness, completeness (unrecognised = 0 points, so gaps
   are frustrating), tier calibration and the gem choice. Time-sensitive sets (new MRT stations, office holders)
   get a `note` with an as-of date.
3. **Validate.** `npm run validate` (also run in `npm test`) enforces: unique kebab-case ids, known
   category, ≥ 12 answers, ≥ 3 easy (common/trap/solid) answers, exactly one gem, that no two answers share
   a normalised name or alias (or differ only in ways matching ignores), which would make matching ambiguous,
   and that every decoy has a reason and doesn't match an answer.
4. **Ship.** Move the prompt into `src/content/packs/<category>.json`. At build time it goes into the dive files
   of the days it's scheduled on and into the lazily loaded bank (see [Loading content](#loading-content)).

Prompts favour **closed, verifiable sets** (stations on a line, Presidents, HDB towns) because they can be
complete. Open sets (hawker dishes, Singlish words) carry long answer lists with spelling variants.

### How rarity is decided (now and later)

- **Now: editorial.** Tiers reflect how likely a typical Singapore resident is to think of an answer, judged by
  the writer and reviewer. `npm run draft` gives them a starting point: three simulated panels of players
  (students and NSFs, working adults, over-45s) each estimate how many of 1,000 would lock in each answer, and
  the weighted shares are cut into tiers with the same thresholds proposed for real data below. That is a
  model's guess at people, so the reviewer has the last word. The gem is chosen for rarity *and* fun.
- **Later: data-driven.** Once there is a backend, log every accepted answer per prompt (anonymous counts only)
  and recompute tiers from real frequency, e.g. top 10% of answers by share = `common`, under 1% = `ulu`.
  Editorial tiers then become the cold-start prior, and `trap` can be detected automatically as "listed
  as rare but heavily picked". Unrecognised inputs that many players type are a review queue for missing
  answers. The proposed formula, thresholds and review-queue rule are in
  [ADR 001](docs/adr/001-answer-stats-backend.md#recomputing-tiers).
- **Until then: player reports.** Every rejected guess is kept on the round result (`attempts`, deduplicated
  by normalised text). The reveal and the results screen list them with a "Should this count?" link, and each
  prompt on the results screen can be reported as having a wrong answer or a tier that feels off. The links
  open a form prefilled with the dive date (`unlimited` for Unlimited), prompt id and guesses: the player form
  set at build time with `VITE_REPORT_URL`, or the GitHub issue form `answer-report.yml` without it (see
  [CONTRIBUTING.md](CONTRIBUTING.md#answer-reports-from-players)). None of this goes in the share text.

## Answer matching

`checkAnswer()` in `game/match.ts` decides what a typed guess means. It runs four stages, strictest first, and
the first with an opinion decides:

| Stage | Accepts | Example |
|---|---|---|
| 1. Exact | The `normalize()` keys are equal: case, accents, punctuation, spacing and a leading "the" are ignored, and `&` is "and" | `char-kway-teow`, `charkwayteow` |
| 2. Loose | The same words once "the", "of", "and" and the prompt's `filler` words are dropped, numbers are written as digits, common short forms are unified and a plural "s" is removed, in any order | `Bishan MRT station`, `Toy Story Two`, `Bt Timah`, `kopi siew dai peng` |
| 3. Partial | In prompts with `partial: true`, the first or last words of exactly one answer's name | `Kuan Yew`, `Einstein` |
| 4. Typo | 1 typo for keys of 5–9 characters, 2 for longer ones, where a typo is a wrong, missing, extra or swapped-with-its-neighbour character, and one answer is strictly closest | `Tampiness`, `Toa Payho`, `Einstien` |

It returns one of four verdicts: `match`; `ambiguous`, when the guess fits several answers equally ("Lee",
"Korea"), so the round asks the player to type more; `decoy`, a known wrong answer with its reason; or `none`.

The rules that keep it from accepting wrong answers:

- **Short keys are exact.** Under 5 characters there is no typo tolerance, so `Bedk` won't become `Bedok` and
  abbreviations like `AMK` stay precise.
- **Ties refuse.** A typo equally close to two answers (`Tampines Eest`) matches neither.
- **Digits are never corrected.** `Toy Story 6` is not a typo for `Toy Story 5`.
- **Decoys compete with answers.** Each prompt can list wrong answers people will type. A guess that is a
  decoy, or closer to one than to any answer, is refused, so `Ireland` is never corrected to `Iceland`.
- **Loose rules are symmetric.** Every loose rule is applied to the input and to the stored answers alike, so
  none favours one answer. Validation fails if two answers become the same under them, or if a decoy matches
  an answer.
- **Partial is opt-in and narrow.** Only an answer's display name counts, only its first or last words, and
  only with a real word of 3+ letters. An earlier, wider version accepted "Sir" and "bin" as people.

Checked against the bank: all 8,100 names and aliases match their own answer, and on 111,000 single-typo
variants of them the previous matcher (Levenshtein, no swaps, no digit rule) corrected 89,436 to the right
answer and 37 to a different one, against 94,481 and 9 now. The 9 are inputs where the test replaced a digit
with a letter. The previous matcher also made 204 corrections that this one refuses: 174 that
changed or dropped a digit, and 30 that were all to the wrong answer (`ewst coast` → East Coast Park).

Matching runs in the browser on every guess, with no network call and no model. A guess is compared with a few
hundred keys at most, and each prompt's keys are computed once.

## The answer animation

`components/elevator/ElevatorScene.tsx` plays between a round and its reveal. `Game` gives it its own phase,
`ride`, after the result is saved (so a reload mid-ride resumes at the next round, as a reload on the reveal does).

- **Scene and motion.** The lift closes its doors, climbs the answer's floors, and opens on the result. Scenery
  scrolls below it; reaching a score threshold upgrades the lift before the doors open. `game/elevator.ts`
  defines floors, upgrades, timing and motion. The same scene appears at rest on the home and results screens.
- **One progression scale.** Every five points climb one floor, starting at 00 and reaching 140 for a perfect
  700. Floors are derived from saved points, so equal scores always reach the same height. Upgrade thresholds
  stay at 100/200/350/500/600 points (floors 20/40/70/100/120). The plate shows points remaining and the target
  floor, with a final progress bar from 600 to 700. Rarity still controls ride duration, so express climbs stay
  short; the indicator and landing signs support three digits.
- **It's the whole window.** The scene isn't a picture on the page: it's fixed to the window and fills it, and
  every screen is laid over it (see [Layout](#layout-the-lifts-world-and-what-lies-over-it)). A ride moves
  everything on screen, and a new lift sweeps in across the whole window.
- **The world takes part in a question.** The lift isn't only the reward for an answer:
  - *The doors are the clock.* `Round` reports the share of the time left on every tick, and `Game` writes it
    to `--clock` on the game's element. The doors' position is that number, so they close as the time runs
    down and an answer has to get in before they shut. A ride shuts them from wherever the clock left them. A
    miss is the clock running out: the doors are shut, the lift shudders and stays put, and they open again on
    the same floor.
  - *The last five seconds.* `Game` also sets `data-pace` (`steady`, `low`, `urgent`). While it's `urgent`,
    the edge of the window flashes red.
  - *A refused guess.* `Round` calls `onRefuse`, `Game` counts the refusals and passes the count to the scene
    as `jolt`, and the car shakes and the boy breaks a sweat. The scene takes one of two class names in turn
    (`scene--jolt-a`, `scene--jolt-b`) with identical animations, so each refusal plays it again.

  The clock changes ten times a second, so it goes straight to the DOM as a custom property and an attribute:
  React doesn't re-render for it.
- **Wide windows.** The scenery is drawn 400 scene units wide. Each scenery layer also carries a mirror image
  of itself on either side (an SVG `<use>` of the same drawing, flipped), so on a window wider than that the
  neighbourhood carries on to the edges. The wings are only displayed above 600px wide.
- **Timing.** A `requestAnimationFrame` loop paints continuous motion directly to the DOM, while React updates
  the floor indicator and ride stages. Timers settle the ride even when frames are throttled in a background tab.
- **Accessibility.** The picture is hidden from screen readers, and focus moves to Skip during a ride. Escape
  skips too, wherever the focus is. A short grace period prevents accidental skips. With reduced motion, `Game` goes straight to the reveal.
- **Tests.** Elevator motion and component tests cover ride timing, skipping, upgrades and cleanup. App tests
  use reduced motion through `test/motion.ts` to focus on storage and flow.

### Motion in the interface

Outside the lift, motion is plain CSS in `styles.css`, and each piece says one thing:

- **Arriving.** A screen fades in, the sign drops into place over the lift, and the controls and the cards step
  up after it. The delays are short, and nothing waits on them: the answer box and the Next button have focus
  from the first frame.
- **The clock.** The timer's lights are teal, amber for the last ten seconds and red and flashing for the last
  five, when each second also lands with a tick on the clock. A refused answer shakes the box and flushes it red,
  and the sign says why. The lift shows all of this too: see [The answer animation](#the-answer-animation).
- **The score.** When a ride lands, the header's score counts up to its new total (`CountUp`), a tag with the
  points earned drops out of the score window, and that round's button on the counter lights up. The results
  count the final score up from zero while the seven lamps come on in the order they were won.
- **`CountUp`.** The element's text is always the real value, so screen readers and tests never see a number in
  between. While it counts, the running number is in a `data-count` attribute and the stylesheet draws it over
  the real one.
- **Reduced motion.** With `prefers-reduced-motion`, every animation and delay is cut to nothing and `CountUp`
  doesn't count, as well as the ride being skipped. The doors don't close with the clock and the window's edge
  doesn't flash: the clock on the sign says the same thing without moving.

## Layout: the lift's world, and what lies over it

The lift scene is the page's background and the game's playing field at once. It's fixed to the window, with
the lift standing `--foot` above the bottom of it. Each screen is a **stack** laid over that, as tall as the
window (`.stack` in `src/styles.css`; the scene's own styles are in `components/elevator/elevator.css`):

| Part | Class | What it's for |
|---|---|---|
| Status | `.game__top`, `.home__brand` | Along the top: the way back, the floor and the score, the seven round buttons and the lift's plate. On home, the title |
| Sky | `.stack__sky` | Takes whatever room is left over |
| The sign | `.board` | A dark board hung on two rods just over the lift: the question and its clock, the verdict and the gem, the final score |
| The lift | `.stack__gap` | Nothing: it's the room the lift itself stands in, one lift high |
| Controls | `.dock` | At the lift's foot: Going up, the answer box, Next question, Share result. During a ride the scene's own bar (the caption and Skip) is here instead |
| Cards | `.extras` | Everything long: the other answers, the lift directory, the breakdown. Below the window on a phone, where `--peek` shows the top of the first card; beside the lift on a wide screen |

A screen's components can come in any order in the markup. `order` places them, so `Round` and `Reveal` each
return a sign, their controls and (for the reveal) their cards, and stay in reading order for a screen reader.
When the window is too short for all of it, the sky goes first, then the gap, so the sign comes down over the
top of the lift. Only what can be read or pressed takes taps: anywhere else, a tap reaches the scene, which is
how tapping the picture skips a ride.

Two custom properties tie the layout to the scene, both on `:root`: `--u`, the size of one pixel of the art,
and `--foot`, the room the controls take. The sign hangs one lift (118 units) above the controls because both
are measured in `--u`.

| Window | Layout |
|---|---|
| A phone, upright | The stack as above, 560px wide at most. The cards are below the window, and scroll up over the lift |
| 600px wide and 620px tall, or more | The same, with bigger pixels: `--u` goes from 2px to 3, then 4, 5 and 6 as the window gets taller |
| 900px wide or more | The status spreads along the top of the window |
| 1000px wide or more | Home puts the title to the left of the lift and the way in to its right, level with it |
| 1200px wide or more | The cards stand to the right of the lift and scroll on their own, so nothing is below the window. A sign with cards beside it narrows to keep clear of them |
| A phone on its side (600px wide or more, 520px tall or less) | No room to stack things over the lift: it stands a quarter of the way across, with the stack in the right half |

- **Typing on a phone.** The on-screen keyboard covers the bottom of the page without resizing it, so `100dvh`
  still measures the whole screen. `viewport.ts` keeps the height that's really visible (from the
  `visualViewport` API) in `--visible-height` on `<html>`, and adds the class `keyboard-open` while a keyboard
  is up. The scene and the stack are both that tall, so the lift stands on top of the keyboard. With the
  keyboard up, the round counter and the plate step aside, the sign tightens, and the answer box becomes a bar
  across the top of the keyboard. The clock, the question and the answer box are always above the keyboard.
  Without the API, the layout falls back to `100dvh`.
- **A short window.** As the visible window gets shorter, the car sinks behind the answer bar, so the strip
  left between the sign and the bar shows the boy's face and the doors closing on it, not the roof of the car.
- **A short phone.** `--u` is 1.5px instead of 2px where the screen is under about 640px tall. It's worked out
  from `100svh`, the height with the browser's bars showing, which doesn't change as they slide away: the
  scenery never changes size mid-game.
- **Words on the scenery.** Text that isn't on a sign, a plate or a card (`.float`, the status labels, the
  ride's caption) has a hard outline, so it reads on any of the six skies.
- **Keyboard and touch extras.** Where there's a mouse or trackpad, the buttons that move the game on show the
  key that presses them (`KeyHint`: Enter for Going up and Next question, Esc for Skip). They already had the
  focus; the hint says so. On phones that can vibrate, `haptics.ts` gives a short buzz when an answer locks in,
  is refused, or time runs out. Neither changes what a screen reader hears.
- **Touch.** Hover styles only apply where there's a pointer to hover with. Buttons don't wait for a double-tap,
  pull-to-refresh is off (a reload mid-question costs seconds the clock doesn't give back), and the stack's
  padding keeps clear of a notch (`viewport-fit=cover` with `env(safe-area-inset-*)`).

## Daily selection

- The date key is today's date in `Asia/Singapore`, independent of the device timezone.
- Each day's prompt ids are **frozen** in `src/content/schedule.json` (`{ "2026-10-27": ["id", …], … }`). The
  file only grows, so adding, editing or reordering prompts never changes a day that's already scheduled.
- `npm run schedule -- --days 30` appends days until the schedule reaches 30 days past today (30 is the default). Each new day takes
  the least recently used prompt from each of 7 different categories, so a prompt rests as long as the bank
  allows before it comes back. Up to `WORLD_ROUNDS_PER_DIVE` (2) of the 7 come from the world categories and
  the rest from the Singapore ones. A day only gets as many world prompts as the world bank can rest for
  `MIN_REPEAT_GAP` days: none with fewer than 7 world prompts, one a day from 7, two from 14. Days already in
  the schedule don't change, so world prompts first appear on the days the next `npm run schedule` adds. With ~8–10 prompts per category that's about 8 days. **Growing the bank is the
  main lever for longevity.** New prompts only appear on days scheduled after they were added, which is why
  the schedule runs a month ahead and not further.
- `npm test` and `npm run validate` check the schedule. For every day: each scheduled id still exists (so a
  prompt can't be deleted or renamed once it's scheduled), it has 7 different prompts, and there are no gaps.
  For days after today, which are the only ones that can still change: no prompt repeats within 7 days
  (`MIN_REPEAT_GAP`, raise it as the bank grows; past days still count as history), each day uses 7
  categories, and no day has more than 2 world prompts. The schedule must also reach at least 14 days past today. When that last check fails, run
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
  prompts under someone who has already started. If the day's file lists different ids from the saved ones,
  the app loads the bank and resumes with the saved prompts.

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
- Answers ship to the client: today's in its dive file, the rest in the lazily loaded bank chunk. Future days
  can still be read by anyone who looks (see [Loading content](#loading-content)). This is fine for a casual
  daily game (Wordle did the same); a backend would be needed for verified leaderboards.

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
   Design and recommendation (proposed, for the team to decide):
   [ADR 001: answer stats backend](docs/adr/001-answer-stats-backend.md), with a throwaway prototype in
   `prototypes/answer-stats/`.
3. Archive of past dives (read from the schedule), themed packs, friends leaderboards.
4. A party mode: same prompts, live room, rarest answer *within the room* wins.
