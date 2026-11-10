# Writing prompts

How to write a prompt for Ulu, and how to review one. It covers the questions that come up every time: which
tier, which aliases, which gem, what goes in the note, and how to record where the answers came from. All
examples are real prompts from `src/content/packs/`.

For setup, branches and the PR flow, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Anatomy of a prompt

```json
{
  "id": "nature-reservoirs",
  "category": "nature",
  "text": "Name a reservoir in Singapore",
  "note": "All 17 count. Upper and Lower are separate reservoirs.",
  "answers": [
    { "name": "MacRitchie Reservoir", "aliases": ["MacRitchie", "Thomson Road Reservoir"], "tier": "common" },
    { "name": "Jurong Lake", "aliases": ["Jurong Lake Reservoir", "Jurong"], "tier": "trap" },
    { "name": "Kranji Reservoir", "aliases": ["Kranji"], "tier": "solid" },
    { "name": "Pandan Reservoir", "aliases": ["Pandan"], "tier": "rare" },
    { "name": "Sarimbun Reservoir", "aliases": ["Sarimbun"], "tier": "ulu" },
    { "name": "Tengeh Reservoir", "aliases": ["Tengeh"], "tier": "gem" }
  ]
}
```

(Shortened; the real prompt lists all 17.)

- **`id`**: kebab-case and unique across all packs. Every existing id is `<category>-<topic>`, e.g.
  `transport-ccl-stations` or `food-kopi-lingo`, so follow that. Pick it carefully: once a prompt is
  scheduled, its id can never change (see [CONTRIBUTING.md](../CONTRIBUTING.md#the-daily-schedule)).
- **`category`**: one of `CATEGORIES` in `src/game/types.ts`, and the same as the pack file it lives in.
- **`text`**: what the player sees. Almost all of them start with "Name a …" and ask for one thing.
- **`note`**: optional. A short line shown under the prompt that sets the rules (see [The note](#the-note)).
- **`answers`**: every accepted answer, each with a `name`, a `tier` and optional `aliases`.
- **`sources`** and **`reviewBy`**: optional, and for sets that can change. The pages the answer list was checked
  against, and the date it next needs checking (see [Sources and review dates](#sources-and-review-dates)).
  Players never see them.

The `name` is what players see on the reveal screen, so use the official or most recognised spelling
("HarbourFront", "one-north", "S. R. Nathan"). Every other spelling goes in `aliases`.

## What `npm run validate` enforces

These come from `src/game/validate.ts`. A prompt that breaks any of them fails CI.

| Rule | Why |
|---|---|
| `id` is kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`) and unique across all packs | The schedule refers to prompts by id |
| `category` is in `CATEGORIES` | Packs and the daily mix are per category |
| `text` isn't empty | |
| At least **12** answers (`MIN_ANSWERS`) | Fewer than that and the prompt is too thin for a rarity game |
| At least **3** easy answers, i.e. `common`, `trap` or `solid` (`MIN_EASY_ANSWERS`) | Players need several easy ways in, otherwise the prompt is just frustrating |
| Exactly **one** `gem` | The reveal shows one gem per prompt |
| Every tier is a known tier | |
| No name or alias normalises to nothing | e.g. an alias written only in Chinese characters (see [Aliases](#aliases)) |
| No two answers share a normalised name or alias | Otherwise one input would match two answers |
| `sources`, if present, is a list of at least one absolute `http` or `https` URL | A source has to be a page someone can open |
| `reviewBy`, if present, is a real date written `YYYY-MM-DD` | The reminders compare it with today's date |

Each pack also needs a `name` and an `asOf` date (`YYYY-MM-DD`, when its facts were last checked) and at least
one prompt.

To check a draft on its own, without the schedule: `npm run validate -- content/drafts/<id>.json`.

It also prints **warnings** (`⚠`), which never fail CI:

| Warning | What to do |
|---|---|
| A prompt's `reviewBy` date is today or has passed | Re-check the prompt (see [When a review is due](#when-a-review-is-due)) |
| A note says "as of" but the prompt has no `reviewBy` | Add `sources` and a `reviewBy` date |

## What makes a good prompt

- **Anyone in Singapore can get on the board.** A good prompt has a few answers almost everyone knows and a long
  tail that rewards people who really know the topic. "Name a station on the Circle Line" works because
  everyone knows Dhoby Ghaut and only some people know Mountbatten.
- **It's answerable in 25 seconds.** Think of answers you'd type, not ones you'd look up.
- **The scope is clear.** If two players could argue about whether an answer counts, the text or the note should
  settle it. "Name a bridge in Singapore" has the note "The Causeway is a causeway, not a bridge!"
- **It's checkable.** Every answer has to be correct. If you can't verify it, leave it out.
- **It's ours.** Most of the fun is in the local deep cuts. A prompt where the best answers are the same anywhere
  in the world doesn't belong here.

### Closed and open sets

**Closed sets** have a definite, complete list: stations on a line, the 17 reservoirs, the 55 planning areas,
the 15 SMCs at GE2025, Presidents and Prime Ministers. Prefer these. They can be complete, so no valid answer
ever scores 0, and reviewers can check them against an official list. **List every member.** If the set is
"all 17", the prompt has 17 answers.

**Open sets** have no single official list: hawker dishes, Singlish words, Singapore brands, kueh. They're
fun, but an unrecognised answer scores 0, so gaps feel unfair. Be generous: `food-hawker-dishes` has 74 answers
and `language-singapore-acronyms` has 132. Use the note to draw the line ("Main dishes and snacks. Drinks and
desserts don't count here."), and expect correction reports for missing answers.

Prompts drafted with `npm run draft` follow the same rules, but the draft is only a starting point. Check
every answer yourself.

## Tiers

| Tier | Label on screen | Points | Meaning |
|---|---|---|---|
| `common` | Everybody Say | 10 | The first thing the whole kopitiam shouts |
| `trap` | Act Smart | 15 | The "obscure" pick everyone thinks only they know |
| `solid` | Can Lah | 30 | Well known, but not the first thing said |
| `rare` | Steady | 60 | Genuinely uncommon |
| `ulu` | Damn Ulu | 85 | True deep cut. Very few go this far |
| `gem` | Sibei Ulu | 100 | The one hand-picked, delightful deep cut |

Labels and points come from `src/game/scoring.ts`. Tiers are editorial for now: they describe how likely a
typical Singapore resident is to think of the answer within 25 seconds. That's not how famous the thing is,
and not how hard it is to spell.

### How to choose

Picture a kopitiam table of people who've lived here all their lives, each given 25 seconds:

- **`common`**: most of the table says it. Keep it to **1–4** per prompt (the packs have 2–4).
- **`trap`**: the answer people pick to sound clever, which so many people pick that it isn't rare. It scores
  **less than `solid`** on purpose. Use **0–2**, and only when you're fairly sure the answer gets
  over-picked.
- **`solid`**: a few people at the table say it, and everyone nods.
- **`rare`**: someone who knows the topic gets it; most of the table doesn't think of it.
- **`ulu`**: only the enthusiast, the one who's been there, or the uncle who remembers.
- **`gem`**: exactly one, chosen by hand (see [The gem](#the-gem)).

The jump from `solid` (30) to `rare` (60) is the biggest decision in most prompts. If most players who know
the topic would come up with it, it's `solid`.

### Examples from the packs

`transport-ccl-stations`, "Name a station on the Circle Line":

| Tier | Answers |
|---|---|
| common | Dhoby Ghaut, HarbourFront, Holland Village, Esplanade |
| trap | Prince Edward Road (opened July 2026, so it's the station everyone has just heard about) |
| solid | Bishan, Paya Lebar, Botanic Gardens, Kent Ridge, … |
| rare | Bras Basah, Nicoll Highway, Telok Blangah, Keppel, … |
| ulu | Mountbatten, Dakota, Marymount, Bukit Brown |
| gem | Haw Par Villa |

`politics-presidents-and-pms`, "Name a President or Prime Minister of Singapore":

| Tier | Answers |
|---|---|
| common | Lee Kuan Yew, Lee Hsien Loong, Lawrence Wong, Tharman Shanmugaratnam |
| solid | Goh Chok Tong, Halimah Yacob, S. R. Nathan, Yusof Ishak, Tony Tan |
| rare | Ong Teng Cheong, Wee Kim Wee |
| ulu | Devan Nair |
| gem | Benjamin Sheares |

More traps from the packs: **Tengah** in `places-hdb-towns` (the newest town), **Fine City** in
`history-names-for-singapore`, **Milo Dinosaur** in `food-kopitiam-drinks`, **Black Thorn** in
`food-durian-varieties`, **Jurong Lake** in `nature-reservoirs`. Each one is the answer someone types
thinking they've found a clever one.

Big open sets lean towards the deep end, which is fine: `culture-jack-neo-films` has 3 common, 9 solid,
16 rare and 20 ulu. Small closed sets don't have room for that, so `politics-presidents-and-pms` has only one
`ulu`.

## Aliases

Aliases are other ways people type the same answer. **Matching already handles a lot**, so don't pad the list
with variants it would accept anyway.

### What matching already does

`normalize()` in `src/game/normalize.ts` turns every name, alias and input into a comparison key. It:

- ignores case, so `bedok` matches Bedok;
- strips accents and punctuation and removes all spaces, so `charkwayteow` and `char-kway-teow` match
  Char Kway Teow, `A.M.K.` matches the alias AMK, and `Kallang / Whampoa` matches Kallang/Whampoa;
- turns `&` into "and", so `fish & chips` matches Fish and Chips;
- drops a leading "the", so `the chicken rice` matches Chicken Rice.

Then `matchAnswer()` in `src/game/match.ts` tries an exact match on every name and alias first. If nothing
matches, it forgives small typos:

- **1 typo** for keys of 5–9 characters (`Tampiness` → Tampines), **2** for 10 or more
  (`char kway teoh` → Char Kway Teow). Keys are measured without spaces.
- **Under 5 characters, the match must be exact.** `Bedk` doesn't become Bedok, `ckts` doesn't become CKT, and
  `lahh` doesn't become lah.
- **A swap counts as two typos.** `Toa Payho` doesn't match Toa Payoh (8 characters, so only 1 allowed).
- The correction is accepted only if **one answer is uniquely closest**. If two answers are equally close,
  nothing matches.

### What you still need to add

- **Local spellings and romanisations**: Char Kuey Teow, Char Kuay Teow, Char Koay Teow; Chwee Kuih;
  Orh Luak and Orh Jian for Oyster Omelette. Different spellings of the same dish are usually more than 1–2
  edits apart, so list them.
- **Other names for the same thing**: Chai Tow Kway for Carrot Cake, Cai Png for Economic Rice, Musang King for
  Mao Shan Wang, Syonan for Syonan-to.
- **Abbreviations Singaporeans actually use**: AMK, TPY, CCK, CKT, BKT, LKY, MOE, MINDEF. They're short, so
  they only ever match exactly. That's what we want, but it means every one has to be listed.
- **Common shortenings**: Bt Timah for Bukit Timah, Holland V for Holland Village, MacRitchie for MacRitchie
  Reservoir. Matching doesn't know these; `Bt Timah` only works because it's an alias.
- **Suffixes people add**: matching doesn't strip words like "MRT", "Station", "Town" or "Reservoir". That's
  why `transport-ccl-stations` lists "Bishan MRT", "Bishan MRT Station" and "Bishan Station", and
  `places-hdb-towns` lists "Tampines Town" and "Tampines New Town".
- **The short name for people**: a surname on its own doesn't match. `Nathan` doesn't match S. R. Nathan,
  which is why Benjamin Sheares has the alias "Sheares" and Tharman Shanmugaratnam has "Tharman". Add the name
  people actually use, if it's unambiguous.
- **Old names, when something is renamed**: `politics-ministries` keeps "MTI" and "Ministry of Trade and
  Industry" as aliases of the Ministry of Energy, Trade and Industry.
- **Short spelling variants**: under 5 characters there's no typo tolerance, so `language-singlish-particles`
  lists "la" for lah and "loh" for lor.

### Rules

- **Romanise.** Normalisation keeps only `a–z` and `0–9`, so an alias in Chinese, Tamil or Jawi script
  normalises to nothing and fails validation. Write it the way people type it: Xinjiapo or Sin Ka Pho, not 新加坡.
- **An alias belongs to one answer.** If a bare word could mean two answers, give it to the one people mean, or
  to neither. In `nature-reservoirs`, bare "Seletar" goes to Upper Seletar Reservoir and "Peirce" to Lower
  Peirce Reservoir. Validation fails if two answers share a normalised key.
- **Don't alias a different valid answer.** If it's its own thing, it's its own answer with its own tier.
- **Watch near-identical names.** Validation only catches exact clashes. When two answers' names or aliases
  are only a typo or two apart, a typo that's equally close to both matches neither. That fails safe (no
  match rather than a wrong one), but it means players lose typo help there, so don't add aliases that
  crowd another answer.
- **Order-dependent phrases need both orders.** `food-kopitiam-drinks` lists both "kopi peng siew dai" and
  "kopi siew dai peng", because word order changes the key.

## The gem

Every prompt has exactly one gem. It's worth 100 points, and it's shown on the reveal to everyone who didn't
get it, so it's the prompt's punchline. A good gem:

- **is definitely valid.** No "well, technically". Check it twice.
- **is gettable.** Someone could plausibly type it in 25 seconds, and the reaction on the reveal is "aiyah, of
  course!", not "what's that?"
- **has a story or a smile.** Michael Jackson (soya bean milk with grass jelly, black and white) in
  `food-kopitiam-drinks`. Di Lo in `food-kopi-lingo`. Haw Par Villa on the Circle Line. Bukit Timah as an HDB
  town. Longyamen (the old Dragon's Teeth Gate) as a name for Singapore.
- **isn't just the most obscure entry.** The deepest answers belong in `ulu`. The gem is the deep cut that's
  also fun.
- **has its aliases too.** Michael Jackson also accepts "MJ" and "Soya Bean with Grass Jelly".

## The note

The note sits under the prompt during the round. Players read it while the clock runs, so keep it short.

**Use it to settle scope**: what counts, what doesn't, and how variants are treated.

> Freshly made drinks, not canned or bottled ones. Sweetness/ice add-ons count as the base drink — 'kopi-o
> kosong peng' is Kopi-O. (`food-kopitiam-drinks`)

> Residents (1819–1826), Governors of the Straits Settlements and Governors of the Colony of Singapore (to
> 1959); acting governors count. Raffles was never one. (`history-colonial-governors`)

**Add an as-of date whenever the set can change.** That covers office holders, ministries and statutory
boards, stations that open or close, gazetted monuments and operating bus interchanges. Start the note with
"As of <Month YYYY>." and name recent changes so players don't get caught out:

> As of October 2026. MTI became the Ministry of Energy, Trade and Industry on 1 Oct 2026.
> (`politics-ministries`)

> Includes the three stations that opened in July 2026 (Keppel, Cantonment, Prince Edward Road) and the
> unopened Bukit Brown station. (`transport-ccl-stations`)

If the set is pinned to an event, give the event and its date instead: "The 15 SMCs on the GE2025 electoral
map (3 May 2025)." When you re-check the facts in a pack, update its `asOf` too.

**Tone**: plain, friendly and brief. One to three short sentences. Use single quotes for examples
('makan', 'D24'), say "count" and "don't count", and allow a little cheek where it helps ("The Causeway is a
causeway, not a bridge!", "No vulgarities, please!").

An example in the note is a free answer for anyone who reads it, so prefer easy ones. Think twice before
naming the gem. Sometimes it can't be helped: the gem in `transport-nsl-stations` is Marina South Pier, which
is also the end of the line the note describes.

## Sources and review dates

Some sets change: office holders, ministries and statutory boards, stations that open or close, gazetted
monuments, operating bus interchanges. A prompt on one of these records where its answers came from and when
to look again:

```json
{
  "id": "transport-dtl-stations",
  "category": "transport",
  "text": "Name a station on the Downtown Line",
  "note": "The blue line, Bukit Panjang to Expo, plus the extension to Xilin and Sungei Bedok (opening on 26 December 2026).",
  "sources": [
    "https://www.lta.gov.sg/content/dam/ltagov/getting_around/public_transport/rail_network/pdf/SM_EN_(Ver210726)_CCL6.pdf",
    "https://www.lta.gov.sg/content/ltagov/en/getting_around/public_transport/rail_network/downtown_line.html",
    "https://www.lta.gov.sg/content/ltagov/en/newsroom/2026/11/news-releases/tel5-dtl3e-passenger-service-26-dec-2026.html"
  ],
  "reviewBy": "2026-12-26",
  "answers": []
}
```

(Shortened; the real prompt lists every station. The first source is LTA's system map, the one page that
shows the whole line. The last is the release that gave the opening date, which is why `reviewBy` is that day.)

**`sources`** is the list of pages you checked the answers against, as full `https://…` URLs.

- Open every page before you list it. A source nobody opened is worth nothing.
- Put the page that lists the whole set first, then the pages for recent changes (a press release, say).
  One to three is usually enough.
- Prefer the official page: the agency's own list over a news report, a news report over Wikipedia. Some sets
  have no official list (every Deputy Prime Minister, every bus terminal). Then use the best page there is,
  and more than one if no single page covers the set.
- Prefer a page that will still be there next year: a landing page over a dated PDF with a version in its
  file name.

**`reviewBy`** is the Singapore date the answers next need checking, written `YYYY-MM-DD`.

- If a change to the set has been announced, use its date: a station's opening day, the day a merger takes
  effect.
- Otherwise use six months from the day you checked. Use less for a set that changes without notice, such as
  the Cabinet.
- A set pinned to a past event ("the GE2025 electoral map") can't change, so it needs neither field.

Set both whenever the note has an as-of date, and whenever the note describes something still to come ("due to
open in late 2026", "don't count yet"). `npm run validate` warns about the first case. The second is yours to
catch.

### When a review is due

From the `reviewBy` date on, `npm run validate` warns about the prompt, and the monthly reminder issue lists it
(see [CONTRIBUTING.md](../CONTRIBUTING.md#fact-reviews)). To clear it:

1. Open each source and compare the answer list with it in both directions: every answer is still true, and
   nothing true is missing. Check the note as well.
2. Fix what changed. Update the note's as-of date and any wording that is now in the past ("due to open"
   becomes "opened"). Replace a source that has moved.
3. Set the next `reviewBy`.
4. Open a content PR, and say in it what you checked and against which source. That applies even when nothing
   changed and the PR only moves the date.

Don't move `reviewBy` forward without doing the check. The warning is the only thing standing between a stale
list and a player who gets zero for a right answer.

## Reviewer checklist

Every new prompt needs a second person to review it, someone other than the writer. Go through this list for
each prompt in a content PR, and say in the review that you did.

**The prompt**
- [ ] The id is `<category>-<topic>`, kebab-case and new. Existing ids are unchanged.
- [ ] The text is clear and asks for one thing. It's answerable in 25 seconds.
- [ ] The scope is settled. Any answer two players could argue about is covered by the text or the note.
- [ ] A time-sensitive set has an as-of date (or an event date) in the note.
- [ ] A set that can change has `sources` and a `reviewBy` date. You opened the sources.
- [ ] If the PR changes `reviewBy`, it says what was checked and against which source.
- [ ] The note is short and in the house tone. If it names the gem, that's on purpose.

**The answers**
- [ ] Every answer is correct. You checked anything you weren't sure of against a source.
- [ ] A closed set is complete: the count matches the official list.
- [ ] An open set is generous. You tried typing ten answers of your own and they were all there.
- [ ] Display names use the official or most recognised spelling.

**Tiers**
- [ ] 1–4 `common`, 0–2 `trap`, exactly one `gem`, and at least 3 `common`/`trap`/`solid`.
- [ ] Read the list from `common` down to `ulu`. The order feels right to someone who grew up here.
- [ ] Every `trap` is something people really over-pick, not just a `solid` with a twist.

**Aliases**
- [ ] Local spellings, other names and the abbreviations people use are listed.
- [ ] "MRT", "Station", "Town" and similar suffixes are covered where people would type them.
- [ ] People can be matched by the short name everyone uses, if it's unambiguous.
- [ ] No alias is really a different answer, and no bare word is given to the wrong answer.
- [ ] No non-Latin script.

**The gem**
- [ ] Definitely valid, gettable in 25 seconds, and fun on the reveal.

**The PR**
- [ ] `npm run validate` and `npm test` pass.
- [ ] One category, titled `content(<category>): …`.
- [ ] No scheduled prompt was deleted or renamed. If `schedule.json` changed, it only gained days at the end.
