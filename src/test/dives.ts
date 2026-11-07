import { act } from '@testing-library/react'
import { vi } from 'vitest'
import { diveFileName, diveFiles } from '../../scripts/dives'
import { ALL_PROMPTS, SCHEDULE } from '../content/bank'

/** Every dive file the build emits, made by the plugin's own function from the real packs and schedule */
const FILES = new Map([...diveFiles(ALL_PROMPTS, SCHEDULE)].map(([date, file]) => [`/${diveFileName(date)}`, file]))

interface Options {
  /** Return a 404 for these dates, as for a date the schedule doesn't have */
  missing?: string[]
  /** Fail the request like a dropped connection while this returns true */
  offline?: () => boolean
}

/**
 * Stub fetch to serve dives/<date>.json like the static host. It answers with a bare { ok, status, json } so
 * nothing depends on a real Response under fake timers. Returns the mock, whose calls are the URLs requested
 */
export function serveDives({ missing = [], offline = () => false }: Options = {}) {
  const fetch = vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    if (offline()) throw new TypeError('Failed to fetch')
    const file = FILES.get(url)
    const date = /dives\/(.+)\.json$/.exec(url)?.[1]
    if (!file || (date && missing.includes(date))) return { ok: false, status: 404, json: async () => null }
    return { ok: true, status: 200, json: async () => structuredClone(file) }
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

/** The URLs fetched so far */
export const fetched = (fetch: ReturnType<typeof serveDives>) => fetch.mock.calls.map(([url]) => String(url))

/**
 * Let pending loads finish without moving the fake clock. findBy and waitFor would advance it in 50 ms steps
 * (the tests' `jest` stub makes Testing Library treat the timers as Jest's), which breaks exact-time checks
 */
export async function settle() {
  for (let i = 0; i < 5; i++) {
    await vi.dynamicImportSettled()
    await act(async () => {})
  }
}
