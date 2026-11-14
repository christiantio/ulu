# ulu

[![CI](https://github.com/christiantio/ulu/actions/workflows/ci.yml/badge.svg)](https://github.com/christiantio/ulu/actions/workflows/ci.yml)

**How ulu can you go?** A daily Singapore trivia game where the most obscure valid answer scores the most.
It's inspired by [Krillion](https://krillion.io).

Every day you get 7 Singapore prompts ("Name a station on the Circle Line", "Name a kueh", …), with 25 seconds
each before the lift doors close. "Toa Payoh" gets you 10 points; the hand-picked gem gets you 100. Every answer
is a ride up: the more ulu it is, the higher the lift climbs, and your score upgrades it from an HDB lift to a
sky penthouse.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests + content validation
npm run validate   # check the question bank and schedule only
npm run build      # static build in dist/, with one dives/<date>.json per scheduled day
npm run check:bundle   # after a build: entry size budget, and no question data in the entry
```

Node version is pinned in `.tool-versions` (asdf).

The first load only fetches the app and today's prompts (`dives/<date>.json`). The full question bank is a
separate chunk that loads when Unlimited starts. Deploy all of `dist/`, `dives/` included. See
[ARCHITECTURE.md](ARCHITECTURE.md#loading-content).

## Deploy settings

The build reads these from the environment, or from a `.env.local` file (not committed; see `.env.example`).
All are optional, and local dev needs none of them.

| Variable | Example | What it does |
|---|---|---|
| `VITE_SITE_URL` | `https://ulu.sg` | The site's origin, for the absolute `og:url` and `og:image` link-preview tags. Unset, both are left out, so shared links preview with the title and description but no image. Set it for the production build |
| `VITE_ANALYTICS_PROVIDER` | `plausible` or `umami` | Turns on analytics (see [Privacy](#privacy)). Unset or anything else, nothing is loaded or sent |
| `VITE_ANALYTICS_SRC` | `https://plausible.io/js/script.js` | The provider's script URL (Plausible's script, or Umami's `script.js`, hosted or self-hosted) |
| `VITE_ANALYTICS_DOMAIN` | `ulu.sg` | The production hostname. Events are only sent from it (or `www.` it), so a preview deploy built with the same settings sends nothing. Also Plausible's site domain |
| `VITE_ANALYTICS_WEBSITE_ID` | `6f9c2a1e-…` | Umami's website id. Required for Umami, unused by Plausible |
| `VITE_REPORT_URL` | `https://tally.so/r/<form-id>?kind={kind}&…` | The player form for answer reports (see [Answer reports](#answer-reports)). Unset, report links open the team's GitHub issue form |

Set the analytics variables on the **production** build only. All four are needed (three for Plausible), and
analytics also stays off on the dev server (`npm run dev`) whatever they say.

## Link previews and icons

`index.html` has the Open Graph and Twitter card tags, and `scripts/site-meta.ts` adds the absolute ones when
`VITE_SITE_URL` is set. The build fails if `dist/index.html` still has an unreplaced `%VITE_…%` placeholder.

The images are rendered from SVG sources with [resvg](https://github.com/yisibl/resvg-js):

| Output | Source |
|---|---|
| `public/og-image.png` (1200×630 share image) | `design/og-image.svg`, with its text converted to paths |
| `public/apple-touch-icon.png` (180×180) | `design/apple-touch-icon.svg`, a square copy of the favicon for iOS to round |
| `public/favicon-48.png` (48×48, for browsers without SVG favicons) | `public/favicon.svg` |

```bash
npx -y @resvg/resvg-js-cli@2.6.2-beta.1 design/og-image.svg public/og-image.png
npx -y @resvg/resvg-js-cli@2.6.2-beta.1 --fit-width 180 design/apple-touch-icon.svg public/apple-touch-icon.png
npx -y @resvg/resvg-js-cli@2.6.2-beta.1 --fit-width 48 public/favicon.svg public/favicon-48.png
```

The icons draw their "u" with Arial, so render them on a machine that has Arial Bold (any Mac does).

## Privacy

Ulu sets no cookies and has no accounts or backend. Progress and stats stay in the browser's `localStorage`,
and nothing a player types is sent anywhere.

With the analytics variables set, the production site loads Plausible or Umami (both cookie-less) through
`src/analytics.ts`. It counts page views and these events, and nothing else:

| Event | When | Property |
|---|---|---|
| `dive_started` | Round 1 of the daily dive starts | none |
| `dive_completed` | The daily dive is finished (once per dive) | `score`: a band, `0-99`, `100-199`, … `600-699`, or `700` |
| `unlimited_started` | An Unlimited game starts | none |
| `share_tapped` | Share result is tapped | `method`: `share` (share sheet) or `copy` (clipboard) |
| `howto_opened` | How to play is opened from its button | none |

No answers, prompt ids or personal data are sent. Without the variables, as in local dev, CI and preview
deploys, no script is loaded and nothing is sent. Either way, the fonts load from Google Fonts, and the web
host keeps its usual server logs. The home screen footer says the same in short, and only mentions analytics
when the build has it. The choice of provider is in [ARCHITECTURE.md](ARCHITECTURE.md#analytics).

## Add questions

Prompts live in `src/content/packs/<category>.json`: eight Singapore categories, and four world ones
(`world`, `science`, `entertainment`, `wildcard`) for general-knowledge rounds. Read
[docs/writing-prompts.md](docs/writing-prompts.md) first: it covers tiers, aliases, decoys, the gem, notes and
the reviewer checklist. Write a prompt by hand, or have Claude propose ideas and draft one for you to review:

```bash
ANTHROPIC_API_KEY=... npm run ideas -- --scope world
```

```bash
ANTHROPIC_API_KEY=... npm run draft -- --category food "Name a kueh"
```

A draft comes with a fact-check and suggested tiers, and lands in `content/drafts/`. Check every answer and
tier, then move the prompt into a pack and run `npm run validate`. The game itself never calls the API; see
[docs/question-pipeline.md](docs/question-pipeline.md).

## Daily schedule

Which prompts run on which day is frozen in `src/content/schedule.json`. Extend it when the tests say it's
running out (they need two weeks of runway):

```bash
npm run schedule   # schedule up to 30 days past today; existing days never change
```

New prompts only appear on days scheduled after they're added. Once a prompt is scheduled, don't delete or
rename it.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design, the content pipeline, how rarity works and the roadmap.

## Answer reports

After each round, the reveal lists the player's rejected guesses with a "Should this count?" link. The results
screen also has "An answer is wrong" and "A tier feels off" links for each prompt. Every link opens a form,
prefilled with the dive date (or `unlimited`), the prompt id and the guesses. Set the form at build time:

```bash
# .env.local, or the host's build settings. See .env.example for the placeholders
VITE_REPORT_URL='https://tally.so/r/<form-id>?kind={kind}&date={date}&prompt={prompt}&guesses={guesses}'
```

`{date}`, `{prompt}`, `{guesses}` and `{kind}` are URL-encoded when they're filled in, which works with Google
Forms (`entry.N={…}`) and Tally prefill links. Without `VITE_REPORT_URL`, the links open the team's GitHub issue
form ([answer-report.yml](.github/ISSUE_TEMPLATE/answer-report.yml)), which players without repo access can't use.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, branch names, the PR flow and what CI checks.
