# Contributing to Ulu

Thanks for helping out! This covers setup, branches, the PR flow, what CI checks and the rules for the daily
schedule. If you're writing prompts, also read [docs/writing-prompts.md](docs/writing-prompts.md).

## Setup

Use the Node version pinned in `.tool-versions` (currently `nodejs 22.22.3`). With asdf or mise, `asdf install`
or `mise install` picks it up. With any other version manager, install that version yourself.

```bash
npm ci             # install exactly what's in package-lock.json
npm run dev        # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm test` | Unit tests, plus content and schedule validation |
| `npm run validate` | Content and schedule validation only, with a readable list of problems |
| `npm run lint` | ESLint |
| `npm run build` | Type-check (`tsc -b`) and build to `dist/` |
| `npm run schedule` | Extend the daily schedule (see [The daily schedule](#the-daily-schedule)) |
| `npm run draft -- --category <category> "Name a …"` | Draft a prompt with Claude (needs `ANTHROPIC_API_KEY` or an `ant auth login` profile) |

## Branches and pull requests

Branch off `main` and open your PR against `main`. Name the branch after the kind of change:

| Prefix | For | Example |
|---|---|---|
| `feat/…` | New features and tooling | `feat/archive-screen` |
| `fix/…` | Bug fixes | `fix/streak-after-midnight` |
| `content/…` | Prompts and content corrections | `content/food-zi-char` |

Write commit messages and PR titles as short imperative sentences ("Show a broken streak as 0 after a missed
day"). Content PRs are titled `content(<category>): …` (see below). Put `Fixes #<issue>` in the PR
description when it closes an issue.

The PR template has a checklist. Fill it in, and add screenshots for any UI change.

## What CI checks

CI (`.github/workflows/ci.yml`) runs on every pull request and on every push to `main`. It uses the Node version
from `.tool-versions` and runs, in order:

1. `npm ci`
2. `npm run lint`
3. `npm test`
4. `npm run validate` (also part of `npm test`, but run on its own for a readable list of content problems)
5. `npm run build` (which includes `tsc -b`)

Run the same commands locally before you push. Note that one check depends on the calendar: the schedule has
to reach 14 days past today, so CI can go red on a PR that didn't touch content. See below.

## Content PRs

1. **Branch**: `content/<something>`, e.g. `content/food-zi-char`.
2. **Write the prompts** by hand, or start with `npm run draft` and check every answer. Drafts land in
   `content/drafts/`. Copy the prompt into `src/content/packs/<category>.json`, and leave the draft file out
   of the PR.
3. **Follow the guide**: [docs/writing-prompts.md](docs/writing-prompts.md) covers tiers, aliases, the gem
   and the note.
4. **Validate**: `npm run validate` and `npm test`.
5. **One category per PR.** Keep a batch of prompts to one pack, and title the PR `content(<category>): …`,
   e.g. `content(food): add zi char and kueh fillings prompts`.
6. **Second review.** Every new prompt needs a review from someone other than its writer, using the
   [reviewer checklist](docs/writing-prompts.md#reviewer-checklist).

### Adding a category

Categories are fixed in code. A new one needs:

- an entry in `CATEGORIES` in `src/game/types.ts`;
- a new pack, `src/content/packs/<category>.json`, with a `name`, an `asOf` date and at least one prompt;
- a new option in the category dropdown in `.github/ISSUE_TEMPLATE/prompt_idea.yml`.

## The daily schedule

Which prompts run on which day is frozen in `src/content/schedule.json`, one line per Singapore date. It is
**append-only**: days already in the file never change, so editing the bank can't reshuffle a dive people
have already played.

- **Keep two weeks of runway.** `npm test` and `npm run validate` fail if the schedule doesn't reach at
  least 14 days past today. When that happens, run `npm run schedule` and commit the updated
  `schedule.json`. It appends days up to 30 days past today (`-- --days <n>` to change that) and leaves
  existing days alone. Never edit existing days by hand.
- **A scheduled prompt can't be deleted or renamed.** Validation fails if any id in the schedule no longer
  exists in a pack. To fix a scheduled prompt, change it in place: answers, aliases, tiers, text and note can
  all change, but the id can't. Fixes take effect on every day the prompt is served, including days that are
  already scheduled. There's no way yet to retire a prompt. If one has to stop appearing, open an issue.
- **New prompts only appear on days scheduled after they're added.** A new prompt waits until
  `npm run schedule` next adds days, so it usually first shows up a few weeks after it's merged. The
  scheduler gives new days to the prompts that have rested longest, so a brand-new prompt goes in early.
- **Schedule conflicts**: if another PR extended `schedule.json` first, don't hand-merge it. Take the version
  on `main` (`git checkout origin/main -- src/content/schedule.json`), run `npm run schedule` again and
  commit the result.

The design behind this is in [ARCHITECTURE.md](ARCHITECTURE.md#daily-selection).

## Reporting problems

Use the issue forms:

- **Bug report**: something in the app is broken.
- **Prompt idea**: a prompt you'd like to see (or write).
- **Content correction**: a missing answer, a wrong answer, or a tier that feels off.

> **TODO (team):** decide who triages bug reports, prompt ideas and content corrections, and how often.
