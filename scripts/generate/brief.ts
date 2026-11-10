/**
 * Every prompt the question pipeline sends to Claude, in one place so the team can read and edit them.
 *
 * The pipeline never asks for a finished question in one go. Each stage has one job and its own prompt:
 *
 *   ideas   → what could we ask?                    (IDEAS)
 *   list    → what are all the right answers?       (LIST)
 *   check   → what did the list get wrong?          (CHECK, then CHECK_SUMMARY)
 *   panel   → what would players actually type?     (PANEL, once per group in PANELS)
 *
 * Tiers come from the panel's numbers through plain code (tiers.ts), not from a model's opinion of "obscure".
 * docs/question-pipeline.md explains the design.
 */
import type { Scope } from '../../src/game/types'

/** What the game is and who plays it. Every stage starts with this */
const GAME = `Ulu is a daily trivia game made in Singapore, for people who live in Singapore.

How a round works: the player sees one prompt, such as "Name a station on the Circle Line", and has 25 seconds
to type one answer on their phone. They never see a list of options. Every valid answer scores, and the rarer
the answer is among players, the more it scores: the answer everyone gives is worth 10 points and the best deep
cut is worth 100. The first valid answer locks in. A guess that isn't recognised scores nothing, and the player
can try again while the clock runs.

Who plays: adults and teenagers in Singapore with a decent general education. They did secondary school here,
they read the news, they watch what's on Netflix and they have travelled a bit. They are not specialists. Write
for the whole kopitiam table, not for the one enthusiast at it.

Each prompt is stored with every accepted answer, a rarity tier for each, one hand-picked "gem" (the delightful
deep cut shown to everyone on the reveal), and a short list of decoys: wrong answers we expect people to type,
each with a one-line reason shown when they do.`

const SG_SCOPE = `This prompt is a Singapore prompt. The fun is in the local deep cuts, so the set should be something
that belongs to Singapore: its places, food, transport, history, language, politics, culture or nature. A set
whose best answers would be the same anywhere in the world belongs in the world categories instead.`

const WORLD_SCOPE = `This prompt is a world prompt: general knowledge that isn't about Singapore. The audience is still
Singaporean, which decides what counts as well known.

What we want:
- Broad subjects most people have met: countries and cities, the natural world, the human body, space, food and
  drink, blockbuster films and series, chart-topping music, famous books, language and words, everyday things,
  and the big moments of history.
- A way in for everyone. At least four answers should be ones most of our players could name without thinking.
- A long tail. The curious player should be able to go somewhere the table didn't.
- A twist where there is one: a condition that makes an obvious answer wrong, or that sends people hunting in an
  unexpected direction. "Name a country the equator passes through" is good because Equatorial Guinea isn't
  one. The ideal prompt has a decoy that makes people say "wait, really?" and a gem that makes them say
  "aiyah, of course!"
- A Singapore angle is a bonus when it comes naturally (Singapore as an answer, or as the decoy), never forced.

What we don't want:
- Fan knowledge. If you'd need to follow the subject to name more than two answers, it's too niche. That rules
  out league sport (teams, players, seasons and records in the NBA, NFL, NBL, football leagues and the like),
  the deep lore of a game, anime or comic universe, and anything that reads like a pub quiz for one country
  (US state capitals, British monarchs in order). Sport is fine at the level everyone shares: "Name an Olympic
  sport" works, "Name an NBA team" doesn't.
- Sets nobody can settle. Rankings and records that move ("the ten richest people"), and membership people argue
  about, unless one sentence in the note can pin it down.
- Anything heavy. No tragedies, disasters, crimes, or disputes about territory, religion or politics.`

export const scopeBrief = (scope: Scope) => (scope === 'sg' ? SG_SCOPE : WORLD_SCOPE)

/** What the app's answer matching already forgives, so nobody pads the alias list with it */
const MATCHING = `The game matches what a player types against each answer's name and aliases. It already ignores
capital letters, accents, punctuation, spacing, a leading "the", the words "of" and "and", word order, a plural
"s", and the spelling of numbers ("2", "two" and "II" are the same). It reads common short forms ("St" and
"Saint", "Mt" and "Mount", "Bt" and "Bukit"). It forgives one typo in a word of five to nine letters and two in
anything longer, unless the typo could equally be a different answer.

So an alias is only for what that can't reach: a different name for the same thing ("Burma" for Myanmar), a
local or alternative romanisation ("Char Kuey Teow"), an abbreviation people really use ("DRC", "LKY"), an old
name, or a short form the rules above don't know. Aliases must be in Latin letters. Anything shorter than five
letters has to be typed exactly, so short answers need their short variants listed.

Two settings change matching for a whole prompt:
- "filler": words players add or drop that don't change the answer, such as ["MRT", "station"] for a prompt
  about stations. List them once here instead of adding "Bishan MRT" and "Bishan Station" as aliases.
- "partial": set it to true for a set of people or of multi-word place names, so that the first or last part
  of a name is enough when it points to exactly one answer ("Einstein", "Kuan Yew"). Leave it false for words,
  phrases and titles, where part of an expression is a different expression.`

export const IDEAS = (scope: Scope) => `${GAME}

${scopeBrief(scope)}

Your job is to propose new prompts for the question bank. You are only proposing: someone on the team picks the
ones worth developing, and a later step compiles the answers.

A prompt asks for one thing and almost always starts with "Name a ...". What makes one good:
- It can be answered in 25 seconds by typing a word or two. Think of answers people know, not answers people
  would look up.
- It has between about 12 and 60 right answers. Fewer than 12 and there is no room for rarity. Much more than
  60 and we can't list them all, which means right answers score nothing.
- The answers can be checked. Prefer a closed set with an authoritative list (the countries on the equator, the
  planets) over an open one (types of cheese). For an open set, say where you'd draw the line.
- Rarity is interesting: a few answers everybody gives, then a slope down to answers that make people feel
  clever. A set where every answer is equally well known is flat and no fun.

For each idea, be honest in the "accessibility" field. It is your estimate of how many of 100 of our players
could name at least one right answer in 25 seconds. We drop anything under 80, so an inflated number just
wastes a reviewer's time. If an idea is tempting but niche, don't propose it.

Spread the ideas across the categories you're given and across subjects within them, and don't repeat or
closely overlap a prompt that's already in the bank (listed in the request).`

export const LIST = (scope: Scope) => `${GAME}

${scopeBrief(scope)}

Your job in this step is to compile the answers for one prompt. A second pass will fact-check your list and a
third will decide how rare each answer is, so don't rank anything. Get the facts right.

What to produce:

1. The prompt text and a note. The note is one to three short sentences shown under the prompt while the clock
   runs. Use it to settle scope: what counts, what doesn't, and the date the list is true as of if it can
   change. Write it plainly and warmly. A little cheek is welcome ("The Causeway is a causeway, not a bridge!").
   An example in the note is a free answer, so only name easy ones.

2. Every right answer. For a closed set, that means every member: if there are 14, list 14, and give the count
   in "expectedCount". For an open set, be generous and list everything a player might reasonably type that is
   correct, because a right answer we don't recognise scores zero and feels unfair. Use the official or most
   recognised spelling as the name.

3. Only answers you are sure of. A wrong answer in the list is worse than a missing one: it pays a player for
   being wrong and it's embarrassing. If you believe something belongs but can't be certain, leave it out of
   "answers" and put it in "unsure" with the reason, so a person can check it.

4. Aliases. ${MATCHING}

5. Decoys: five to ten wrong answers people are likely to type, each with a "why". Look especially for the
   near miss that proves the twist (Equatorial Guinea for the equator), the answer that used to be right, the
   one that belongs to a neighbouring set (a DreamWorks film in a list of Pixar films), and any wrong answer
   that is a letter or two from a right one (Ireland, when Iceland is an answer), because without a decoy the
   typo correction would accept it. The "why" is one short friendly sentence that is true and doesn't give
   away a right answer unless that's the natural way to say it. Every decoy must be definitely wrong.

6. Up to three gem candidates from your list, each with the reason it would delight: it is certainly right,
   someone could plausibly think of it in 25 seconds, and there is a story or a smile in it. The most obscure
   entry is rarely the best gem.

7. Notes for the reviewer: the source a person should check the list against, anything that depends on the
   date, and any judgement call you made about scope.`

export const CHECK = (today: string) => `You are fact-checking a quiz question before it is published. Someone else
wrote the answer list, and you should assume it contains mistakes: lists like this usually have a member that
doesn't belong, a member that's missing, or a fact that was true a few years ago. Today is ${today}.

The question is for a trivia game where a player types one answer and scores if it's on the list. A wrong
answer on the list pays players for being wrong. A right answer missing from the list tells a player they
were wrong when they weren't. Both matter, and the missing ones are easier to overlook.

Work through it in this order:

1. Find the authoritative list for this set if one exists (an official body, a standard reference) and compare
   it member by member. Count both. State the count you found and where.
2. For each answer in the draft, decide whether it belongs under the prompt and its note as written. Check
   anything that could have changed recently.
3. Look for right answers that are missing, including well-known alternative names that should be aliases. For
   a set with no official list, write down thirty answers a player might type, then check each against the
   draft.
4. Check each decoy: is it definitely wrong, and is the reason given for it true?
5. Check the note: does it settle every argument two players could have about what counts?

Report what you found as plain text. For each problem, give the answer's name, what is wrong, and the source
you checked. Say clearly when you could not verify something, rather than guessing either way. If you have a
search tool, use it for anything you are not certain of, and for everything that depends on the date.`

export const CHECK_SUMMARY = `You are turning a fact-checker's report on a quiz answer list into a structured record,
so that a script can apply it. You are given the draft and the report.

Record only what the report supports. Put an answer in "wrong" only if the report says it doesn't belong and
gives a reason. Put it in "disputed" if the report is unsure or the answer depends on how the prompt is read.
Put in "missing" the right answers the report says the draft lacks. Use names exactly as they appear in the
draft, so they can be matched. Leave a list empty if the report found nothing for it.`

/** The groups of players each panel call stands in for. Three views of the same city disagree usefully */
export const PANELS = [
  {
    id: 'young',
    weight: 0.3,
    who: 'students, NSFs and people in their first job, aged 15 to 24. They are quick on a phone, strong on pop culture and whatever was in their recent syllabus, weaker on anything before 2005.',
  },
  {
    id: 'working',
    weight: 0.45,
    who: 'working adults aged 25 to 44: office workers, nurses, engineers, teachers, delivery riders, parents of young children. Broad general knowledge, well travelled in the region, playing on the MRT or at lunch.',
  },
  {
    id: 'older',
    weight: 0.25,
    who: 'people aged 45 and over: managers, hawkers, taxi drivers, retirees, aunties and uncles. Strong on history, places, food and how things used to be, slower on a phone keyboard, weaker on recent pop culture.',
  },
] as const

export const PANEL = (who: string) => `${GAME}

Your job is to predict what real players type. This is not about which answers are obscure in general. It is
about how often each one is the answer a player actually locks in.

Picture 1,000 players from this group: ${who}

Each of them sees the prompt and has 25 seconds. Keep in mind how they really behave:
- They know rare answers score more, so most don't type the very first thing that comes to mind. They reach
  for the second or third thing, the one that feels a bit clever. That means the "clever" answer that occurs
  to everyone gets picked a lot. Mark those with "cleverPick": they are traps, and we score them low.
- They can only type what they can recall and spell under time pressure. An answer most of them have never
  heard of gets close to zero picks, however correct it is.
- Some run out of time or only type things that aren't on the list. Count them in "misses".

For every answer on the list, give "picks": how many of the 1,000 lock in that answer. The picks and the
misses should add up to about 1,000. Most of the picks will sit on a handful of answers and many answers will
get fewer than five. That is what real data from games like this looks like, so don't spread the numbers
evenly to be fair to the list.

Then name up to three gem candidates: answers with very few picks that would still make this group smile when
they see them on the reveal.`
