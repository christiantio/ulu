// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { analyticsConfig, loadAnalytics, scoreBucket, track } from './analytics'

const PLAUSIBLE = {
  VITE_ANALYTICS_PROVIDER: 'plausible',
  VITE_ANALYTICS_SRC: 'https://plausible.io/js/script.js',
  // jsdom's location is http://localhost:3000/
  VITE_ANALYTICS_DOMAIN: 'localhost',
}
const UMAMI = {
  VITE_ANALYTICS_PROVIDER: 'umami',
  VITE_ANALYTICS_SRC: 'https://cloud.umami.is/script.js',
  VITE_ANALYTICS_DOMAIN: 'localhost',
  VITE_ANALYTICS_WEBSITE_ID: '6f9c2a1e-0000-4000-8000-000000000000',
}

/** A production build with these settings (vitest runs as dev, which turns analytics off) */
function configure(env: Record<string, string>) {
  vi.stubEnv('DEV', false)
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
}

const providers = () => {
  const plausible = vi.fn()
  const umami = { track: vi.fn() }
  vi.stubGlobal('plausible', plausible)
  vi.stubGlobal('umami', umami)
  return { plausible, umami: umami.track }
}

const analyticsScript = () => document.querySelector<HTMLScriptElement>('script[data-ulu-analytics]')

beforeEach(() => {
  // Whatever the shell running the tests has set, start from an unconfigured build
  for (const key of Object.keys(UMAMI)) vi.stubEnv(key, '')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  analyticsScript()?.remove()
})

describe('track', () => {
  it('does nothing when analytics is not configured', () => {
    vi.stubEnv('DEV', false)
    const { plausible, umami } = providers()
    expect(analyticsConfig()).toBeNull()
    track('dive_started')
    track('share_tapped', { method: 'copy' })
    expect(plausible).not.toHaveBeenCalled()
    expect(umami).not.toHaveBeenCalled()
  })

  it('does nothing on the dev server, even when configured', () => {
    configure(PLAUSIBLE)
    vi.stubEnv('DEV', true)
    const { plausible } = providers()
    track('dive_started')
    expect(plausible).not.toHaveBeenCalled()
  })

  it('does nothing on a host other than the configured domain, as on a preview deploy', () => {
    configure({ ...PLAUSIBLE, VITE_ANALYTICS_DOMAIN: 'ulu.sg' })
    const { plausible } = providers()
    track('dive_started')
    expect(plausible).not.toHaveBeenCalled()
  })

  it('needs a website id for Umami', () => {
    configure({ ...UMAMI, VITE_ANALYTICS_WEBSITE_ID: '' })
    const { umami } = providers()
    expect(analyticsConfig()).toBeNull()
    track('howto_opened')
    expect(umami).not.toHaveBeenCalled()
  })

  it('sends Plausible events with their props', () => {
    configure(PLAUSIBLE)
    const { plausible, umami } = providers()
    track('dive_started')
    track('dive_completed', { score: '300-399' })
    track('share_tapped', { method: 'share' })
    expect(plausible.mock.calls).toEqual([
      ['dive_started', undefined],
      ['dive_completed', { props: { score: '300-399' } }],
      ['share_tapped', { props: { method: 'share' } }],
    ])
    expect(umami).not.toHaveBeenCalled()
  })

  it('sends Umami events with their data', () => {
    configure(UMAMI)
    const { plausible, umami } = providers()
    track('unlimited_started')
    track('share_tapped', { method: 'copy' })
    expect(umami.mock.calls).toEqual([['unlimited_started', undefined], ['share_tapped', { method: 'copy' }]])
    expect(plausible).not.toHaveBeenCalled()
  })

  it('never throws, even if the provider script is missing or broken', () => {
    configure(PLAUSIBLE)
    expect(() => track('dive_started')).not.toThrow()
    vi.stubGlobal('plausible', () => {
      throw new Error('blocked')
    })
    expect(() => track('dive_started')).not.toThrow()
  })
})

describe('loadAnalytics', () => {
  it('adds no script unless analytics is active', () => {
    loadAnalytics()
    configure(PLAUSIBLE)
    vi.stubEnv('DEV', true)
    loadAnalytics()
    configure({ ...PLAUSIBLE, VITE_ANALYTICS_DOMAIN: 'ulu.sg' })
    loadAnalytics()
    expect(analyticsScript()).toBeNull()
  })

  it("adds Plausible's script with its domain, and queues events until it loads", () => {
    configure(PLAUSIBLE)
    loadAnalytics()
    loadAnalytics()
    const scripts = document.querySelectorAll('script[data-ulu-analytics]')
    expect(scripts).toHaveLength(1)
    const script = scripts[0] as HTMLScriptElement
    expect(script.src).toBe(PLAUSIBLE.VITE_ANALYTICS_SRC)
    expect(script.defer).toBe(true)
    expect(script.dataset.domain).toBe('localhost')

    track('dive_completed', { score: '700' })
    expect(window.plausible?.q).toEqual([['dive_completed', { props: { score: '700' } }]])
  })

  it("adds Umami's script with its website id and allowed hosts", () => {
    configure(UMAMI)
    loadAnalytics()
    const script = analyticsScript()!
    expect(script.src).toBe(UMAMI.VITE_ANALYTICS_SRC)
    expect(script.dataset.websiteId).toBe(UMAMI.VITE_ANALYTICS_WEBSITE_ID)
    expect(script.dataset.domains).toBe('localhost,www.localhost')
  })
})

describe('scoreBucket', () => {
  it.each([
    [0, '0-99'],
    [10, '0-99'],
    [99, '0-99'],
    [100, '100-199'],
    [410, '400-499'],
    [600, '600-699'],
    [699, '600-699'],
    [700, '700'],
  ])('puts %i in %s', (score, bucket) => {
    expect(scoreBucket(score)).toBe(bucket)
  })
})
