import { describe, expect, it } from 'vitest'
import { normalize } from '../../../src/game/normalize'
import type { Prompt } from '../../../src/game/types'
import { dayState, parseSubmission, scrubGuesses } from '../src/rules'

const sgt = (local: string) => new Date(`${local}+08:00`)

describe('dayState', () => {
  it('is open for today, closed for earlier days and refuses future days', () => {
    const now = sgt('2026-10-31T10:00:00')
    expect(dayState('2026-10-31', now)).toBe('open')
    expect(dayState('2026-10-30', now)).toBe('closed')
    expect(dayState('2026-11-01', now)).toBe('future')
  })

  it('keeps yesterday open for 30 minutes after Singapore midnight', () => {
    expect(dayState('2026-10-31', sgt('2026-11-01T00:29:59'))).toBe('open')
    expect(dayState('2026-10-31', sgt('2026-11-01T00:30:01'))).toBe('closed')
  })
})

describe('scrubGuesses', () => {
  it('drops personal-data shapes, long text, known answers and repeats', () => {
    const known = new Set([normalize('Bras Basah')])
    const kept = scrubGuesses(
      [
        '  Bencoolen ',
        'bencoolen',
        'BRAS BASAH',
        'me@example.com',
        'call 9123 4567',
        'S1234567D',
        'x'.repeat(41),
        '',
        'Rochor',
      ],
      known,
    )
    expect(kept).toEqual([
      { key: 'bencoolen', text: 'Bencoolen' },
      { key: 'rochor', text: 'Rochor' },
    ])
  })
})

describe('parseSubmission', () => {
  const prompt: Prompt = {
    id: 'transport-ccl-stations',
    category: 'transport',
    text: 'Name a station on the Circle Line',
    answers: [
      { name: 'Dhoby Ghaut', tier: 'common' },
      { name: 'one-north', aliases: ['One North'], tier: 'rare' },
    ],
  }
  const lookup = (date: string, id: string) => (date === '2026-10-31' && id === prompt.id ? prompt : undefined)
  const body = {
    date: '2026-10-31',
    promptId: prompt.id,
    deviceId: '3b241101-e2bb-4255-8caf-4136c566a962',
    answer: 'one-north',
    attempts: ['Bencoolen', 'one north'],
  }

  it('accepts a canonical answer and keeps only unknown guesses', () => {
    const result = parseSubmission(body, lookup)
    expect(result).toEqual({
      ok: true,
      value: {
        date: '2026-10-31',
        promptId: prompt.id,
        deviceId: body.deviceId,
        answerKey: 'onenorth',
        guesses: [{ key: 'bencoolen', text: 'Bencoolen' }],
      },
    })
  })

  it('records a miss as an empty answer key', () => {
    const result = parseSubmission({ ...body, answer: null }, lookup)
    expect(result.ok && result.value.answerKey).toBe('')
  })

  it('rejects a prompt that was not scheduled that day, or an answer it does not have', () => {
    expect(parseSubmission({ ...body, date: '2026-11-01' }, lookup)).toMatchObject({ ok: false, status: 422 })
    expect(parseSubmission({ ...body, answer: 'Bedok' }, lookup)).toMatchObject({ ok: false, status: 422 })
  })

  it('rejects malformed bodies', () => {
    expect(parseSubmission(null, lookup)).toMatchObject({ ok: false, status: 400 })
    expect(parseSubmission({ ...body, deviceId: 'not-a-uuid' }, lookup)).toMatchObject({ ok: false, status: 400 })
    expect(parseSubmission({ ...body, attempts: [1] }, lookup)).toMatchObject({ ok: false, status: 400 })
  })
})
