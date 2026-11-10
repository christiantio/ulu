import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { checkAnswer } from '../../src/game/match'
import { validatePacks } from '../../src/game/validate'
import { CHECK, IDEAS, LIST, PANEL, PANELS } from './brief'
import type { Llm, Request } from './llm'
import { applyCheck, asPack, describeList, draftPrompt, proposeIdeas, summarise } from './pipeline'
import { CheckSchema, IdeasSchema, ListSchema, PanelSchema, type AnswerList, type Check, type Idea, type Panel } from './schemas'
import { MAX_COMMON, assignTiers, type PanelResult } from './tiers'

const TODAY = '2026-11-10'

const noProblems: Check = {
  verdict: 'ok',
  officialCount: 0,
  wrong: [],
  disputed: [],
  missing: [],
  decoyProblems: [],
  noteProblems: [],
  unverified: [],
}

/** A panel where each named answer gets these picks out of 1,000, and everything else gets none */
function panel(picks: Record<string, number>, extra: Partial<PanelResult> & { clever?: string[] } = {}): PanelResult {
  const total = Object.values(picks).reduce((a, b) => a + b, 0)
  return {
    weight: 1,
    misses: 1000 - total,
    answers: Object.entries(picks).map(([name, n]) => ({ name, picks: n, cleverPick: extra.clever?.includes(name) ?? false })),
    gemCandidates: [],
    ...extra,
  }
}

describe('assignTiers', () => {
  const names = ['Earth', 'Mars', 'Jupiter', 'Saturn', 'Venus', 'Pluto', 'Neptune', 'Mercury', 'Uranus', 'Eris', 'Haumea', 'Ceres']
  const picks = { Earth: 150, Mars: 220, Jupiter: 130, Saturn: 110, Venus: 60, Pluto: 120, Neptune: 50, Mercury: 40, Uranus: 35, Eris: 15, Haumea: 2, Ceres: 6 }
  const tiers = (estimates: ReturnType<typeof assignTiers>) => Object.fromEntries(estimates.map((e) => [e.name, e.tier]))

  it('turns shares into tiers on the ADR 001 scale', () => {
    const result = tiers(assignTiers(names, [panel(picks)]))
    expect(result).toMatchObject({ Mars: 'common', Earth: 'common', Venus: 'solid', Neptune: 'solid', Eris: 'rare' })
    // Nobody proposed a gem, so the rarest answer is one, with a note to pick a better one
    expect(result.Haumea).toBe('gem')
    expect(result.Ceres).toBe('ulu')
  })

  it('makes a popular clever pick a trap when most of the panels say so', () => {
    const one = panel(picks, { weight: 0.3, clever: ['Pluto'] })
    const two = panel(picks, { weight: 0.45, clever: ['Pluto', 'Eris'] })
    const three = panel(picks, { weight: 0.25 })
    const result = tiers(assignTiers(names, [one, two, three]))
    expect(result.Pluto).toBe('trap')
    // Clever, but too few players pick it for it to be a trap
    expect(result.Eris).toBe('rare')
    // One panel on its own isn't enough
    expect(tiers(assignTiers(names, [one, three, three])).Pluto).toBe('common')
  })

  it('takes the gem the stages voted for, as long as it is a deep cut', () => {
    const voted = panel(picks, { gemCandidates: [{ name: 'Ceres' }, { name: 'Mars' }] })
    expect(tiers(assignTiers(names, [voted])).Ceres).toBe('gem')
    // The list stage's candidates count as a vote too
    expect(tiers(assignTiers(names, [panel(picks)], ['Eris'])).Eris).toBe('gem')
    // A popular answer can't be the gem however many votes it gets
    expect(tiers(assignTiers(names, [voted, voted], ['Mars'])).Mars).toBe('common')
  })

  it('weighs the panels and counts a name a panel left out as no picks', () => {
    const young = panel({ Mars: 400 }, { weight: 0.25 })
    const older = panel({ Mars: 0, Earth: 500 }, { weight: 0.75 })
    const [mars, earth] = assignTiers(['Mars', 'Earth'], [young, older])
    expect(mars.share).toBeCloseTo(0.1)
    expect(earth.share).toBeCloseTo(0.375)
  })

  it('always gives a prompt that passes validation: commons capped, enough easy answers, one gem', () => {
    const flat = Object.fromEntries(names.map((n) => [n, 80]))
    const none = Object.fromEntries(names.map((n) => [n, 1]))
    for (const p of [picks, flat, none]) {
      const estimates = assignTiers(names, [panel(p)])
      const count = (tier: string) => estimates.filter((e) => e.tier === tier).length
      expect(count('gem')).toBe(1)
      expect(count('common')).toBeGreaterThanOrEqual(1)
      expect(count('common')).toBeLessThanOrEqual(MAX_COMMON)
      const prompt = { id: 'science-x', category: 'science' as const, text: 'x', answers: estimates.map(({ name, tier }) => ({ name, tier })) }
      expect(validatePacks({ 'x.json': asPack(prompt, TODAY) })).toEqual([])
    }
    // Six answers at 15% each: only four can be common, and the two that were moved say why
    const six = assignTiers(names.slice(0, 6), [panel(Object.fromEntries(names.slice(0, 6).map((n) => [n, 150])))])
    expect(six.filter((e) => e.tier === 'common')).toHaveLength(MAX_COMMON)
    expect(six.filter((e) => e.tier !== 'common').map((e) => Boolean(e.flag))).toEqual([true, true])
  })
})

const list: AnswerList = {
  id: 'world-nordic-countries',
  text: 'Name a Nordic country',
  note: 'The five sovereign states.',
  setType: 'closed',
  expectedCount: 5,
  answers: [
    { name: 'Iceland', aliases: [] },
    { name: 'Norway', aliases: ['Norge'] },
    { name: 'Sweden', aliases: [] },
    { name: 'Estonia', aliases: [] },
  ],
  unsure: [{ name: 'Greenland', reason: 'Self-governing, but part of the Kingdom of Denmark' }],
  decoys: [
    { name: 'Ireland', aliases: ['Eire'], why: "Close, but it's not Nordic." },
    { name: 'Finland', aliases: [], why: 'Scandinavian? No. Nordic? Hmm.' },
    { name: 'Netherlands', aliases: ['Holland'], why: 'Flat, cold and not Nordic.' },
  ],
  filler: [],
  partial: false,
  gemCandidates: [{ name: 'Iceland', reason: 'x' }],
  timeSensitive: false,
  reviewerNotes: 'Check against the Nordic Council members.',
}

const check: Check = {
  ...noProblems,
  verdict: 'fixable',
  officialCount: 5,
  wrong: [{ name: 'estonia', reason: 'Baltic, not Nordic', source: 'norden.org' }],
  missing: [
    { name: 'Denmark', aliases: ['Danmark'], reason: 'A member', source: 'norden.org' },
    { name: 'Finland', aliases: ['Suomi'], reason: 'A member', source: 'norden.org' },
    { name: 'Norge', aliases: [], reason: 'Local name', source: '' },
  ],
  decoyProblems: [{ name: 'Netherlands', reason: 'The reason given is rude about the Dutch' }],
}

describe('applyCheck', () => {
  const checked = applyCheck(list, check)

  it('drops wrong answers and adds missing ones, without duplicating an alias', () => {
    expect(checked.answers.map((a) => a.name)).toEqual(['Iceland', 'Norway', 'Sweden', 'Denmark', 'Finland'])
    expect(checked.answers.find((a) => a.name === 'Finland')?.aliases).toEqual(['Suomi'])
  })

  it('drops a decoy the checker doubts, and one that turned out to be an answer', () => {
    expect(checked.decoys.map((d) => d.name)).toEqual(['Ireland'])
  })

  it('leaves the original list alone', () => {
    expect(list.answers).toHaveLength(4)
    expect(list.decoys).toHaveLength(3)
  })
})

/** An Llm that replies from canned data and records what it was sent */
function stub(replies: { ideas?: Idea[]; list?: AnswerList; check?: Check; panel?: (stage: string) => Panel }) {
  const sent: (Request & { search?: boolean })[] = []
  const llm: Llm = {
    async ask<T>(schema: z.ZodType<T>, request: Request): Promise<T> {
      sent.push(request)
      const reply =
        (schema as unknown) === IdeasSchema ? { ideas: replies.ideas }
        : (schema as unknown) === ListSchema ? replies.list
        : (schema as unknown) === CheckSchema ? replies.check
        : (schema as unknown) === PanelSchema ? replies.panel?.(request.stage)
        : undefined // prettier-ignore
      // Parsing proves the canned reply has the shape the real API is asked for
      return schema.parse(reply)
    },
    async research(request) {
      sent.push(request)
      return 'Estonia is Baltic. Denmark and Finland are missing. Source: norden.org'
    },
  }
  return { llm, sent }
}

describe('draftPrompt', () => {
  const picks = { Sweden: 400, Norway: 300, Denmark: 150, Finland: 100, Iceland: 20 }
  const replies = {
    list,
    check,
    panel: (): Panel => ({
      misses: 30,
      answers: Object.entries(picks).map(([name, n]) => ({ name, picks: n, cleverPick: false })),
      gemCandidates: [{ name: 'Iceland', reason: 'x' }],
    }),
  }
  const run = async (search = true) => {
    const { llm, sent } = stub(replies)
    const stages: string[] = []
    const draft = await draftPrompt(llm, { category: 'world', idea: 'Name a Nordic country', today: TODAY, search, onStage: (s) => stages.push(s) })
    return { draft, sent, stages }
  }

  it('runs list, check, check summary and one panel per group, in that order', async () => {
    const { sent, stages } = await run()
    expect(sent.map((r) => r.stage)).toEqual(['list', 'check', 'check summary', ...PANELS.map((p) => `panel (${p.id})`)])
    expect(stages.map((s) => s.split(':')[0])).toEqual(['list', 'check', 'panel', 'lint'])
    expect(sent[0].system).toBe(LIST('world'))
    expect(sent[1].system).toBe(CHECK(TODAY))
    expect(sent[3].system).toBe(PANEL(PANELS[0].who))
  })

  it('only lets the checker search when asked to', async () => {
    expect((await run(true)).sent[1].search).toBe(true)
    expect((await run(false)).sent[1].search).toBe(false)
  })

  it('shows the panels the checked list, not the writer\'s', async () => {
    const { sent } = await run()
    const panelRequest = sent[3].user
    expect(panelRequest).toContain('- Denmark')
    expect(panelRequest).not.toContain('Estonia')
    // The panels judge names only: no aliases, no decoys, no tiers to anchor on
    expect(panelRequest).not.toContain('Norge')
    expect(panelRequest).not.toContain('Ireland')
  })

  it('produces a prompt that passes validation and plays correctly', async () => {
    const { draft } = await run()
    expect(draft.review.errors).toEqual(['world-nordic-countries.json › world-nordic-countries: only 5 answers (min 12)'])
    expect(draft.prompt).toMatchObject({ id: 'world-nordic-countries', category: 'world', text: 'Name a Nordic country' })
    expect(Object.fromEntries(draft.prompt.answers.map((a) => [a.name, a.tier]))).toEqual({
      Sweden: 'common',
      Norway: 'common',
      Denmark: 'common',
      Finland: 'common',
      Iceland: 'gem',
    })
    expect(checkAnswer('Suomi', draft.prompt)).toMatchObject({ kind: 'match', answer: { name: 'Finland' } })
    expect(checkAnswer('Ireland', draft.prompt)).toMatchObject({ kind: 'decoy' })
    // Settings left at their defaults aren't written out
    expect(draft.prompt).not.toHaveProperty('partial')
    expect(draft.prompt).not.toHaveProperty('filler')
  })

  it('tells the reviewer what was changed and what to look at', async () => {
    const { draft } = await run()
    const { warnings, counts, estimates } = draft.review
    expect(counts).toEqual({ answers: 5, expected: 5, official: 5 })
    expect(warnings).toContain('Removed "estonia": Baltic, not Nordic (norden.org)')
    expect(warnings).toContain('Added "Denmark": A member (norden.org)')
    expect(warnings).toContain('The writer left out "Greenland": Self-governing, but part of the Kingdom of Denmark')
    expect(warnings.some((w) => w.startsWith('Removed decoy "Netherlands"'))).toBe(true)
    expect(estimates.map((e) => e.name)).toEqual(['Sweden', 'Norway', 'Denmark', 'Finland', 'Iceland'])
    expect(summarise(draft)).toContain(' 40.0%  common  Sweden')
  })

  it('flags a closed set whose count disagrees with the checker\'s source', async () => {
    const { llm } = stub({ ...replies, check: { ...check, officialCount: 6 } })
    const draft = await draftPrompt(llm, { category: 'world', idea: 'x', today: TODAY, search: false })
    expect(draft.review.warnings).toContain("The checker's source lists 6 members; the draft has 5.")
  })
})

describe('proposeIdeas', () => {
  const idea = (text: string, accessibility: number, category: Idea['category'] = 'science'): Idea => ({
    text,
    category,
    setType: 'closed',
    size: 20,
    easyAnswers: [],
    deepCuts: [],
    gem: '',
    twist: '',
    sgAngle: '',
    accessibility,
    risks: '',
    source: '',
  })

  it('keeps the accessible ideas, best first, and drops niche, repeated and off-category ones', async () => {
    const { llm, sent } = stub({
      ideas: [
        idea('Name a noble gas', 82),
        idea('Name an NBA team', 35),
        idea('Name a planet', 99),
        idea('name a PLANET or dwarf planet!', 97),
        idea('Name an HDB town', 99, 'places'),
      ],
    })
    const request = { scope: 'world' as const, categories: ['science'] as const, count: 5, existing: ['Name a planet or dwarf planet'] }
    const { kept, dropped } = await proposeIdeas(llm, request)
    expect(kept.map((i) => i.text)).toEqual(['Name a planet', 'Name a noble gas'])
    expect(dropped.map((i) => i.text)).toEqual(['Name an NBA team'])
    expect(sent[0].system).toBe(IDEAS('world'))
    expect(sent[0].user).toContain('- Name a planet or dwarf planet')
  })
})

describe('the prompts', () => {
  it('give each scope its own brief', () => {
    expect(LIST('world')).toContain('This prompt is a world prompt')
    expect(LIST('sg')).toContain('This prompt is a Singapore prompt')
    expect(LIST('sg')).not.toContain('league sport')
    expect(IDEAS('world')).toContain('league sport')
  })

  it('describe a list to the checker with aliases and decoy reasons', () => {
    const text = describeList(list)
    expect(text).toContain('- Norway (also: Norge)')
    expect(text).toContain("- Ireland: Close, but it's not Nordic.")
  })

  it('weigh the panels to a whole', () => {
    expect(PANELS.reduce((sum, p) => sum + p.weight, 0)).toBeCloseTo(1)
  })
})
