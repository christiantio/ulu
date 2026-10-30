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

## Add questions

Prompts live in `src/content/packs/<category>.json`. Write one by hand, or draft one with Claude and then
review it:

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
