# The question pipeline

How Ulu uses Claude to produce prompts, and where it doesn't. For what makes a prompt good, and how to review
one, see [writing-prompts.md](writing-prompts.md).

> **Status, November 2026.** The pipeline is tested end to end against a stub model
> (`scripts/generate/pipeline.test.ts`), not yet against the real API. Expect to tune the prompts in
> `scripts/generate/brief.ts` after the first real drafts.

## Where the model is used

| | Uses Claude? | Why |
|---|---|---|
| Proposing prompt ideas | Yes, offline | It's quick at breadth, and a person picks |
| Compiling a prompt's answers, aliases and decoys | Yes, offline | A first draft of 20 to 100 answers is the slow part of writing a prompt |
| Fact-checking that draft | Yes, offline, with web search | A second pass that didn't write the list finds what the first one missed |
| Estimating how rare each answer is | Yes, offline | A starting point for tiers until we have real answer counts |
| Deciding what ships | **No.** A person reviews every prompt | Models leave members out of lists and put wrong ones in |
| Judging a player's answer during a game | **No.** Plain code, `src/game/match.ts` | It has to be instant, free, the same for everyone, and work offline |
| Choosing the day's prompts | **No.** The frozen schedule | Everyone gets the same dive |

So the answer to "should the game call an LLM?" is: the tooling does, the game never does. The site stays a
static bundle with no key in it, a player's answer is never sent anywhere, and nothing a model wrote reaches
players until someone has checked it.

## The stages

`npm run ideas` runs the first stage. `npm run draft` runs the rest for one idea.

| Stage | Its one job | Prompt in `brief.ts` | Reply |
|---|---|---|---|
| **ideas** | Propose prompts worth writing, and rate honestly how many players could answer each | `IDEAS` | Ideas with sample answers, a twist, risks and a source. Under 80/100 "could answer" is dropped |
| **list** | Compile every right answer, with aliases, decoys, a scope note and gem candidates. No ranking | `LIST` | The answer list, plus anything it wasn't sure of, kept out of the list for a person to check |
| **check** | Assume the list has mistakes and find them: wrong members, missing members, stale facts, false decoy reasons | `CHECK`, then `CHECK_SUMMARY` | A report in prose with sources, then the same findings as data. Wrong answers are removed, missing ones added, disputed ones kept and flagged |
| **panel** | Predict what 1,000 players would actually type, for three groups of players | `PANEL`, once per group in `PANELS` | Picks per answer, which answers are "clever" picks, gem candidates |
| **tiers** | Turn the picks into tiers | none: `tiers.ts` | One tier per answer, and a reason wherever a rule overrode the numbers |
| **lint** | Run content validation and the matching checks on the result | none | Errors that block shipping, warnings for the reviewer |

Why separate stages rather than one "write me a question" call:

- **Facts and rarity are different questions.** Asked for both at once, a model starts leaving out answers it
  finds dull and promoting ones it finds interesting. The list stage is told not to rank at all.
- **The checker didn't write the list.** It gets the answers with no tiers and no reasoning, is told to assume
  errors, and can search the web. It reports in prose first because search results carry citations, which the
  API can't combine with structured output; a small second call turns the report into data.
- **Tiers come from numbers, through code.** The panel is asked a concrete question (how many of 1,000 lock in
  this answer), and `assignTiers()` applies fixed cut-offs: 10% or more of players is `common`, 3% is `solid`,
  1% is `rare`, less is `ulu`. These are the cut-offs [ADR 001](adr/001-answer-stats-backend.md#recomputing-tiers)
  proposes for real answer counts, so drafted tiers and later data-driven ones are on one scale. A `trap` is an
  answer most of the panels call a clever pick and at least 3% of players choose. The gem is the deep cut with
  the most votes from the list stage and the panels.
- **Three panels, weighted.** Students and NSFs, working adults, and people over 45 recall different things. One
  blended estimate hides that; three that disagree are more honest, and the weights are in `PANELS`.

The panel is still a model guessing at people. Treat its numbers as a first opinion to argue with, not as data.
Real counts replace them once the answer-stats backend exists.

## Running it

```bash
npm run ideas -- --scope world
```

```bash
npm run ideas -- --scope world --category science --count 10 --theme "things with a Singapore decoy"
```

```bash
npm run draft -- --category world "Name a country the equator passes through"
```

Both need `ANTHROPIC_API_KEY`, or an `ant auth login` profile. Other options:

- `--prompts` on either command prints the prompts it would send and exits, with no API call. Use it to read
  what the model is told, or to check an edit to `brief.ts`.
- `--no-search` on `draft` has the checker work from what the model knows instead of searching. Use it for
  sets that can't have changed.

Ideas land in `content/ideas/` and drafts in `content/drafts/`. Both folders are git-ignored. A draft file is
a pack with one prompt plus a `review` block: the checker's report, what was added and removed, the panels'
estimate for every answer, and the warnings. `npm run validate -- content/drafts/<id>.json` works on it as is.

All calls use `claude-opus-5-5`. If it declines a request, the API retries on another model.

## What a person still does

The draft is where review starts. Go through the [reviewer checklist](writing-prompts.md#reviewer-checklist),
and in particular:

- Check a closed set against the source yourself. The draft says how many members the writer expected and how
  many the checker's source had; if those differ, find out why.
- Read every "Added", "Removed", "Disputed" and "Not verified" line in the review block.
- Read the tiers from `common` down. The panel's shares are next to them. Move what feels wrong: you know the
  kopitiam table better than the model does.
- Choose the gem on purpose. The pipeline's pick is a suggestion.
- Try the prompt: type ten answers of your own, three wrong ones, and a few typos.

## Changing the prompts

Every prompt is a plain string in `scripts/generate/brief.ts`. The editorial rules for world prompts (broad
subjects, no fan knowledge, a twist where there is one) live in `WORLD_SCOPE` there, and the Singapore ones in
`SG_SCOPE`. If drafts keep coming back with the same problem, fix it in the brief so every later draft
benefits, and say what you changed in the PR.
