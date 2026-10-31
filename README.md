# ulu

[![CI](https://github.com/christiantio/ulu/actions/workflows/ci.yml/badge.svg)](https://github.com/christiantio/ulu/actions/workflows/ci.yml)

**How ulu can you go?** A daily Singapore trivia game where the most obscure valid answer scores the most.
It's inspired by [Krillion](https://krillion.io).

Every day you get 7 Singapore prompts ("Name a station on the Circle Line", "Name a kueh", …) with 25 seconds
each. "Toa Payoh" gets you 10 points; the hand-picked gem gets you 100. Your score takes you from Raffles Place
out to Pedra Branca.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests + content validation
npm run validate   # check the question bank and schedule only
npm run build      # static build in dist/
```

Node version is pinned in `.tool-versions` (asdf).

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

Prompts live in `src/content/packs/<category>.json`. Read [docs/writing-prompts.md](docs/writing-prompts.md)
first: it covers tiers, aliases, the gem, notes and the reviewer checklist. Write a prompt by hand, or draft
one with Claude and then review it:

```bash
ANTHROPIC_API_KEY=... npm run draft -- --category food "Name a kueh"
```

Drafts land in `content/drafts/`. Check every answer and tier, then move the prompt into a pack and run
`npm run validate`.

## Daily schedule

Which prompts run on which day is frozen in `src/content/schedule.json`. Extend it when the tests say it's
running out (they need two weeks of runway):

```bash
npm run schedule   # schedule up to 30 days past today; existing days never change
```

New prompts only appear on days scheduled after they're added. Once a prompt is scheduled, don't delete or
rename it.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design, the content pipeline, how rarity works and the roadmap.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, branch names, the PR flow and what CI checks.
