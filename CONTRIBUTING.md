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

Build-time settings (only `VITE_REPORT_URL` so far, see [Answer reports from players](#answer-reports-from-players))
are listed in `.env.example`. Copy it to `.env.local` if you need one locally.

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm test` | Unit and component tests, plus content and schedule validation |
| `npm run validate` | Content and schedule validation only, with a readable list of problems and of prompts due a fact review |
| `npm run review:due` | List the prompts that are overdue for a fact review or fall due in the next 31 days (see [Fact reviews](#fact-reviews)) |
| `npm run lint` | ESLint |
| `npm run build` | Type-check (`tsc -b`) and build to `dist/`, including one `dives/<date>.json` per scheduled day |
| `npm run check:bundle` | After a build: check the entry JS against its size budget, check it has no question data, and check every day's dive file is there |
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
4. `npm run validate` (also part of `npm test`, but run on its own for a readable list of content problems). Its
   warnings about fact reviews don't fail the run (see [Fact reviews](#fact-reviews))
5. `npm run build` (which includes `tsc -b`)
6. `npm run check:bundle`

Run the same commands locally before you push.

### The bundle check

The first load should only download the app and today's prompts (see
[ARCHITECTURE.md](ARCHITECTURE.md#loading-content)). `npm run check:bundle` reads `dist/` and prints the
sizes. It fails if:

- the entry JS is over its budget, 300 kB raw or 95 kB gzipped (`ENTRY_BUDGET` in `scripts/check-bundle.ts`);
- any prompt id, prompt text or gem name is in the entry JS. That usually means something imported
  `src/content/bank.ts` or `schedule.json` directly. Go through `loadBank()` instead;
- a scheduled day has no `dives/<date>.json`, or the file doesn't match the schedule.

If a feature really needs a bigger entry, raise the budget in the same PR and say why in the description. Note that one check depends on the calendar: the schedule has
to reach 14 days past today, so CI can go red on a PR that didn't touch content. See below.

## Content PRs

1. **Branch**: `content/<something>`, e.g. `content/food-zi-char`.
2. **Write the prompts** by hand, or start with `npm run draft` and check every answer. Drafts land in
   `content/drafts/`. Copy the prompt into `src/content/packs/<category>.json`, and leave the draft file out
   of the PR.
3. **Follow the guide**: [docs/writing-prompts.md](docs/writing-prompts.md) covers tiers, aliases, the gem,
   the note, and the `sources` and `reviewBy` date a changeable set needs.
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

## Fact reviews

Some prompts are about sets that change: Cabinet ministers, MRT stations, bus interchanges, national monuments.
Each of these records the `sources` its answers were checked against and a `reviewBy` date for the next check.
[docs/writing-prompts.md](docs/writing-prompts.md#sources-and-review-dates) says how to choose both.

**Warnings.** `npm run validate` prints a warning, marked `⚠`, in two cases:

```
⚠ transport.json › transport-dtl-stations: was due for review on 2026-12-26
⚠ politics.json › politics-ministries: the note says "as of" but the prompt has no reviewBy date

✓ 67 prompts in 8 pack(s) are valid, with 2 warning(s)
```

- The first means the prompt's `reviewBy` date is today or has passed.
- The second means a note has an as-of date but nobody has said when to check it again.

Warnings don't fail `npm run validate`, `npm test` or CI, so they never block a PR. In GitHub Actions they also
appear as annotations on the run. If you see one for a prompt you aren't working on, leave it: the reminder
issue below is where it gets picked up.

**The monthly reminder.** On the 1st of each month, the
[review reminder workflow](.github/workflows/review-reminder.yml) lists every prompt that is overdue or falls
due in the next 31 days, with its sources, in an issue labelled `review-due`. If last month's issue is still
open, it updates that issue instead of opening another. If nothing is due, it does nothing. Run
`npm run review:due` to see the same list locally, or start the workflow by hand from the Actions tab.

**Doing a review.** Follow
[When a review is due](docs/writing-prompts.md#when-a-review-is-due): check the answers and the note against
the sources, fix what changed, set the next `reviewBy`, and open a content PR that says what you checked.
Close the reminder issue when every prompt on it is done. Closing it is how the team knows the month's reviews
are finished, and the next run opens a fresh one.

> **TODO (team):** decide who picks up the reminder issue each month, along with the triage in
> [Answer reports from players](#answer-reports-from-players).

## Reporting problems

Use the issue forms:

- **Bug report**: something in the app is broken.
- **Prompt idea**: a prompt you'd like to see (or write).
- **Answer report** (`answer-report.yml`): a missing answer, a wrong answer, or a tier that feels off.

### Answer reports from players

Players report answers from inside the game. The reveal lists their rejected guesses with a "Should this
count?" link (a missing answer). Each prompt on the results screen has "An answer is wrong" and "A tier feels
off" links. Each link opens a form prefilled with the dive date (`unlimited` for Unlimited), the prompt id and,
for a missing answer, the guesses separated by `; `.

Most players don't have GitHub, so the player form is a Google Form or Tally form, set at build time with
`VITE_REPORT_URL`:

- It's a prefill URL with `{date}`, `{prompt}`, `{guesses}` and `{kind}` placeholders. Each one is URL-encoded
  when it's filled in. `.env.example` has examples for both services.
- `{kind}` becomes `Missing answer`, `Wrong answer` or `Tier feels off`. Make the form's choices exactly these,
  because both services prefill a choice by its text.
- Set it in the host's build settings for production. Locally, put it in `.env.local` (git-ignored), not `.env`.
- Without it, the links open `answer-report.yml` on GitHub, prefilled through its field ids (`kind`, `prompt`,
  `dive`, `answer`). That's fine for the team, but players without repo access can't use it. If you change
  those ids or the `kind` options, update `src/game/report.ts` to match.

The URL is built in `src/game/report.ts` and tested in `report.test.ts`. A fix that comes out of a report is an
ordinary content PR (see [Content PRs](#content-prs)).

> **TODO (team):** decide who triages bug reports, prompt ideas and answer reports (the GitHub form and the
> player form's responses), and how often. Also create the player form and set `VITE_REPORT_URL` in the
> production build. Later, the backend (#17) can collect rejected guesses automatically.
