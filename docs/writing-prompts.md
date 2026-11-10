# Writing prompts

How to write a prompt for Ulu, and how to review one. It covers the questions that come up every time: which
tier, which aliases, which gem, and what goes in the note. All examples are real prompts from
`src/content/packs/`.

For setup, branches and the PR flow, see [CONTRIBUTING.md](../CONTRIBUTING.md). To have Claude draft a prompt
for you to review, see [question-pipeline.md](question-pipeline.md).

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
- **`decoys`**: optional. Wrong answers we expect people to type, each with a `name`, optional `aliases` and a
  `why` shown to the player (see [Decoys](#decoys)).
- **`filler`**: optional. Words players add or leave out that don't change the answer, e.g.
  `["MRT", "station"]` (see [What matching already does](#what-matching-already-does)).
- **`partial`**: optional. `true` lets the first or last part of a name stand for the answer, for sets of
  people and multi-word places (see [Part of a name](#part-of-a-name)).

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
| No two answers are the same once filler, word order and number spellings are ignored | Same reason, for the looser stage of matching: "Rocky II" and "Rocky 2" can't be two answers |
| Every decoy has a `name` and a `why`, and doesn't match any answer | A decoy that matched an answer would refuse a right answer |

Each pack also needs a `name` and an `asOf` date (`YYYY-MM-DD`, when its facts were last checked) and at least
one prompt.

To check a draft on its own, without the schedule: `npm run validate -- content/drafts/<id>.json`.

## What makes a good prompt

- **Anyone in Singapore can get on the board.** A good prompt has a few answers almost everyone knows and a long
  tail that rewards people who really know the topic. "Name a station on the Circle Line" works because
  everyone knows Dhoby Ghaut and only some people know Mountbatten.
- **It's answerable in 25 seconds.** Think of answers you'd type, not ones you'd look up.
- **The scope is clear.** If two players could argue about whether an answer counts, the text or the note should
  settle it. "Name a bridge in Singapore" has the note "The Causeway is a causeway, not a bridge!"
- **It's checkable.** Every answer has to be correct. If you can't verify it, leave it out.
- **It's in the right place.** A Singapore prompt is ours: most of the fun is in the local deep cuts, and a set
  whose best answers are the same anywhere in the world doesn't belong in a Singapore category. That set might
  be a world prompt instead (next section).

### World prompts

A dive is mostly Singapore prompts, with up to two world prompts for a change of pace (see
[ARCHITECTURE.md](../ARCHITECTURE.md#daily-selection)). World prompts live in four categories: `world`
(countries, cities, landmarks), `science` (nature, space, the body), `entertainment` (films, series, music,
books) and `wildcard` (words, symbols, everyday things, anything with a catch). The players are still
Singaporean, and that decides what counts as well known. A world prompt has to clear a higher bar than "it has
a list":

- **Broad, not fan knowledge.** If you'd need to follow the subject to name more than two answers, it's too
  niche. No league sport (teams, players and seasons in the NBA, NFL, NBL or a football league), no deep lore
  of one game or anime, nothing that's a pub quiz for another country. Sport is fine at the level everyone
  shares: "Name an Olympic sport", not "Name an NBA team".
- **Four answers everyone has.** Most of the table should be able to name at least four without thinking.
- **A twist where there is one.** The best world prompts have a condition that makes an obvious answer wrong.
  "Name a country the equator passes through" works because Equatorial Guinea isn't one, and Singapore just
  misses. That wrong answer becomes a [decoy](#decoys).
- **Settled.** No rankings that move ("the ten richest people"), and no sets people argue about unless one
  sentence in the note ends the argument. `science-planets-and-dwarf-planets` says "the 5 dwarf planets the
  International Astronomical Union recognises".
- **Light.** No disasters, crimes, or disputes over territory, religion or politics.
- **A Singapore angle is a bonus**, when it comes naturally: Singapore as an answer or as the decoy.

Tiers still mean what they mean everywhere else: how likely a typical Singapore resident is to type the answer.

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
every answer yourself. The draft comes with a fact-checker's report and an estimate of how often each answer
would be picked ([question-pipeline.md](question-pipeline.md)).

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

`checkAnswer()` in `src/game/match.ts` works out what a player meant in four stages, from strictest to most
forgiving. The first stage that has an opinion decides.

**1. Exact.** `normalize()` turns every name, alias and input into a key, and the keys must be equal. It:

- ignores case, so `bedok` matches Bedok;
- strips accents and punctuation and removes all spaces, so `charkwayteow` and `char-kway-teow` match
  Char Kway Teow, `A.M.K.` matches the alias AMK, and `Kallang / Whampoa` matches Kallang/Whampoa;
- turns `&` into "and", so `fish & chips` matches Fish and Chips;
- drops a leading "the", so `the chicken rice` matches Chicken Rice.

**2. Loose.** The same words, compared more generously (`looseWords()`):

- "the", "of" and "and" are dropped anywhere, and so are the prompt's **`filler`** words. With
  `"filler": ["MRT", "station"]`, `Bishan MRT`, `Bishan Station` and `MRT Bishan` all match Bishan;
- numbers are numbers however they're written: `Toy Story Two`, `Toy Story II` and `Toy Story 2`;
  `Henry the Eighth` and `Henry VIII`. (Not a lone "I", "V" or "X", which are usually letters, as in Holland V.)
- common short forms are read: `Bt Timah` for Bukit Timah, `Mt Faber`, `St James`, `Tg Pagar`, `Kg Glam`,
  `Upp Thomson`, `Jln Besar`, `Lor Chuan`, and `Rd`, `Ave`, `Dr` for Road, Avenue, Drive;
- a plural "s" doesn't matter: `fish balls` matches Fish Ball;
- word order doesn't matter: `kopi siew dai peng` matches Kopi Peng Siew Dai.

**3. Part of a name**, only in prompts with `"partial": true` (see [Part of a name](#part-of-a-name)).

**4. Typos.**

- **1 typo** for keys of 5–9 characters (`Tampiness` → Tampines), **2** for 10 or more
  (`char kway teoh` → Char Kway Teow). Keys are measured without spaces.
- A typo is a wrong, missing or extra character, or **two neighbouring characters swapped**:
  `Toa Payho` matches Toa Payoh.
- **Under 5 characters, the match must be exact.** `Bedk` doesn't become Bedok, `ckts` doesn't become CKT, and
  `lahh` doesn't become lah.
- **Digits are never corrected.** `Toy Story 6` isn't a typo for Toy Story 5, and `12 Storeys` has to be typed
  with its 12.
- The correction is accepted only if **one answer is strictly closest**. If two answers are equally close,
  nothing matches: `Tampines Eest` could be East or West.
- **Decoys compete.** A guess that is closer to a decoy than to any answer is refused as that decoy, so
  `Ireland` is never "corrected" to Iceland.

A guess gets one of four verdicts: a match; **ambiguous**, when it fits more than one answer equally (the
player is asked to type a bit more, and the guess stays in the box); a **decoy**, shown with its reason; or
not recognised.

### Part of a name

With `"partial": true`, the first or last words of an answer's **name** are enough when they point to exactly
one answer: `Kuan Yew` or `Lee Kuan` for Lee Kuan Yew, `Einstein` for Albert Einstein, `Einstien` too. When
they point to several, the verdict is ambiguous: `Lee` in `politics-presidents-and-pms`, or `Korea` where both
Koreas are answers.

- Only the name counts, not aliases, and only its two ends, not the middle. So keep titles out of names:
  "Shenton Thomas", with "Sir Shenton Thomas" as an alias.
- The part needs a real word of three letters or more. A bare number or an initial isn't enough.
- **Turn it on for sets of people and of multi-word places.** Six people prompts have it, e.g.
  `politics-presidents-and-pms` and `history-wwii-people`.
- **Leave it off for words, phrases and titles**, where part of an expression is a different expression:
  "lau" is not "wah lau", and "Story" is not a Pixar film.

### What you still need to add

- **Local spellings and romanisations**: Char Kuey Teow, Char Kuay Teow, Char Koay Teow; Chwee Kuih;
  Orh Luak and Orh Jian for Oyster Omelette. Different spellings of the same dish are usually more than 1–2
  edits apart, so list them.
- **Other names for the same thing**: Chai Tow Kway for Carrot Cake, Cai Png for Economic Rice, Musang King for
  Mao Shan Wang, Syonan for Syonan-to, Burma for Myanmar.
- **Abbreviations Singaporeans actually use**: AMK, TPY, CCK, CKT, BKT, LKY, MOE, MINDEF, DRC. They're short,
  so they only ever match exactly. That's what we want, but it means every one has to be listed.
- **Shortenings matching doesn't know**: Holland V for Holland Village, MacRitchie for MacRitchie Reservoir.
  (For a word that every answer in the prompt can carry, like "Reservoir" or "MRT", use `filler` instead of an
  alias on each answer.)
- **The short name for people**, in a prompt without `partial`: a surname on its own doesn't match there. In a
  prompt with `partial`, still add the names that aren't part of the display name: "Harry Lee", "LKY".
- **Old names, when something is renamed**: `politics-ministries` keeps "MTI" and "Ministry of Trade and
  Industry" as aliases of the Ministry of Energy, Trade and Industry.
- **Short spelling variants**: under 5 characters there's no typo tolerance, so `language-singlish-particles`
  lists "la" for lah and "loh" for lor.

Older prompts list variants that matching now handles on its own ("Bishan MRT Station", both orders of a kopi
order). They're harmless. Don't add new ones.

### Rules

- **Romanise.** Normalisation keeps only `a–z` and `0–9`, so an alias in Chinese, Tamil or Jawi script
  normalises to nothing and fails validation. Write it the way people type it: Xinjiapo or Sin Ka Pho, not 新加坡.
- **An alias belongs to one answer.** If a bare word could mean two answers, give it to the one people mean, or
  to neither. In `nature-reservoirs`, bare "Seletar" goes to Upper Seletar Reservoir and "Peirce" to Lower
  Peirce Reservoir. Validation fails if two answers share a normalised key.
- **Don't alias a different valid answer.** If it's its own thing, it's its own answer with its own tier.
- **Watch near-identical names.** When two answers' names or aliases are only a typo or two apart, a typo
  that's equally close to both matches neither. That fails safe (no match rather than a wrong one), but it
  means players lose typo help there, so don't add aliases that crowd another answer. `npm run draft` lists
  these pairs in its review notes.
- **Choose `filler` words that never tell two answers apart.** If "Bedok" and "Bedok Reservoir" are both
  answers, "reservoir" can't be filler. Validation fails if filler makes two answers the same.

## Decoys

A decoy is a wrong answer we expect people to type. When a player types one, the round says why it doesn't
count and lets them try again:

```json
"decoys": [
  { "name": "Equatorial Guinea", "why": "Despite the name! Its mainland is north of the equator and its island of Annobón is south." },
  { "name": "Singapore", "why": "So close! We're about 1° north of it." }
]
```

They do two jobs. They stop typo correction from paying out for a wrong answer: without a decoy, "Ireland"
is one typo from Iceland and would score as it. And they're where a prompt's twist lands: the moment a player
finds out that Shrek isn't Pixar or that Elsa isn't an official Disney Princess is part of the fun.

What to list:

- **Any wrong answer a typo or two from a right one.** This is the one that matters for correctness.
- **The near miss that makes the twist**: Equatorial Guinea for the equator, Scandium (number 21) for the
  first 20 elements.
- **The neighbouring set**: DreamWorks and Disney Animation films in `entertainment-pixar-films`, moons in
  `science-planets-and-dwarf-planets`, the old Able-Baker words in `wildcard-nato-alphabet`.
- **The one that used to be right**, when a set has changed.

Five to ten is plenty. A decoy isn't needed for every wrong answer, only the ones people will really type.

The `why` is one short sentence in the same voice as the note. It must be **true** (it's a fact we're stating
to the player, so check it like an answer), and it shouldn't hand over a right answer unless that's the
natural way to say it. Decoys take aliases like answers do. A decoy never appears in the player's list of
rejected guesses, since "Should this count?" has already been answered.

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

## Reviewer checklist

Every new prompt needs a second person to review it, someone other than the writer. Go through this list for
each prompt in a content PR, and say in the review that you did.

**The prompt**
- [ ] The id is `<category>-<topic>`, kebab-case and new. Existing ids are unchanged.
- [ ] The text is clear and asks for one thing. It's answerable in 25 seconds.
- [ ] The scope is settled. Any answer two players could argue about is covered by the text or the note.
- [ ] A time-sensitive set has an as-of date (or an event date) in the note.
- [ ] The note is short and in the house tone. If it names the gem, that's on purpose.

**World prompts**
- [ ] It's broad: no league sport, no fan lore, no other country's pub quiz. Four answers the whole table has.
- [ ] Nothing in it is a ranking that moves or a membership people argue about, or the note settles it.

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
- [ ] People can be matched by the short name everyone uses, if it's unambiguous. A set of people has
      `"partial": true`, and no display name starts with a title.
- [ ] `filler` words, if any, never tell two answers apart.
- [ ] No alias is really a different answer, and no bare word is given to the wrong answer.
- [ ] No non-Latin script.

**Decoys**
- [ ] Every decoy is definitely wrong, and its `why` is true.
- [ ] Any wrong answer a typo or two from a right one is a decoy.
- [ ] No `why` gives away the gem.

**The gem**
- [ ] Definitely valid, gettable in 25 seconds, and fun on the reveal.

**A prompt drafted with `npm run draft`**
- [ ] You read the review block: every "Added", "Removed", "Disputed" and "Not verified" line.
- [ ] You checked a closed set against the source yourself, not only against the checker's count.
- [ ] You chose the tiers and the gem. The panel's numbers are a starting point.

**The PR**
- [ ] `npm run validate` and `npm test` pass.
- [ ] One category, titled `content(<category>): …`.
- [ ] No scheduled prompt was deleted or renamed. If `schedule.json` changed, it only gained days at the end.
