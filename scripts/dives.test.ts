import { join } from 'node:path'
import type { ResolvedConfig, ViteDevServer } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import type { Prompt } from '../src/game/types'
import { diveDateFromUrl, diveFileName, diveFiles, dives, readContent } from './dives'

const root = join(import.meta.dirname, '..')
const { prompts, schedule } = readContent(join(root, 'src', 'content'))
const prompt = (id: string): Prompt => ({ id, category: 'food', text: `Name ${id}`, answers: [] })

describe('diveFiles', () => {
  it('makes one file per scheduled date with the full prompts in schedule order', () => {
    const bank = ['a', 'b', 'c', 'd'].map(prompt)
    const files = diveFiles(bank, { '2026-11-02': ['d', 'a'], '2026-11-01': ['c', 'b'] })
    expect([...files.keys()]).toEqual(['2026-11-01', '2026-11-02'])
    expect(files.get('2026-11-02')).toEqual({ date: '2026-11-02', prompts: [bank[3], bank[0]] })
  })

  it('fails on a scheduled id that no pack has', () => {
    expect(() => diveFiles([prompt('a')], { '2026-11-01': ['a', 'gone'] })).toThrow(/2026-11-01 lists "gone"/)
  })

  it('covers every day of the real schedule', () => {
    const files = diveFiles(prompts, schedule)
    expect(files.size).toBe(Object.keys(schedule).length)
    for (const [date, ids] of Object.entries(schedule)) {
      const file = files.get(date)!
      expect(file.prompts.map((p) => p.id)).toEqual(ids)
      // Whole prompts, answers and all, as the reveal and results screens need them
      expect(file.prompts.every((p) => p.answers.length >= 12 && p.answers.some((a) => a.tier === 'gem'))).toBe(true)
    }
  })
})

describe('diveDateFromUrl', () => {
  it('finds the date in a dive file request, under any base and with a query', () => {
    expect(diveDateFromUrl('/dives/2026-11-03.json')).toBe('2026-11-03')
    expect(diveDateFromUrl('/ulu/dives/2026-11-03.json?t=123')).toBe('2026-11-03')
    expect(diveDateFromUrl(`/${diveFileName('2026-11-03')}`)).toBe('2026-11-03')
  })

  it('ignores everything else', () => {
    const others = ['/', '/index.html', '/dives/', '/dives/today.json', '/dives/2026-11-03.json.map', '/src/dives.ts']
    for (const url of others) expect(diveDateFromUrl(url)).toBeNull()
  })
})

describe('dives plugin', () => {
  const plugin = dives()
  // Call a hook the way Vite would, with `this` standing in for its plugin context
  const call = (hook: unknown, ctx: object, ...args: unknown[]) =>
    (hook as (this: object, ...a: unknown[]) => unknown).call(ctx, ...args)
  call(plugin.configResolved, {}, { root } as ResolvedConfig)

  it('emits dives/<date>.json for every scheduled date at build time', () => {
    const emitFile = vi.fn()
    call(plugin.generateBundle, { emitFile })
    expect(emitFile).toHaveBeenCalledTimes(Object.keys(schedule).length)
    const files = diveFiles(prompts, schedule)
    for (const [{ type, fileName, source }] of emitFile.mock.calls) {
      expect(type).toBe('asset')
      const date = diveDateFromUrl(fileName)!
      expect(fileName).toBe(`dives/${date}.json`)
      expect(JSON.parse(source)).toEqual(files.get(date))
    }
  })

  describe('in dev', () => {
    let middleware: (req: { url?: string }, res: Record<string, unknown>, next: () => void) => void
    const server = { middlewares: { use: (fn: typeof middleware) => (middleware = fn) } }
    call(plugin.configureServer, {}, server as unknown as ViteDevServer)

    const request = (url: string) => {
      const res = { statusCode: 0, headers: {} as Record<string, string>, body: '' }
      const next = vi.fn()
      middleware(
        { url },
        Object.assign(res, {
          setHeader: (k: string, v: string) => (res.headers[k] = v),
          end: (body: string) => (res.body = body),
        }),
        next,
      )
      return { ...res, next }
    }

    it('serves a scheduled day as JSON', () => {
      const date = Object.keys(schedule)[3]
      const res = request(`/dives/${date}.json`)
      expect(res.statusCode).toBe(200)
      expect(res.headers['Content-Type']).toBe('application/json')
      expect(JSON.parse(res.body)).toEqual(diveFiles(prompts, schedule).get(date))
      expect(res.next).not.toHaveBeenCalled()
    })

    it("answers an unscheduled day with a 404, not the SPA's index.html", () => {
      const res = request('/dives/2099-01-01.json')
      expect(res.statusCode).toBe(404)
      expect(res.next).not.toHaveBeenCalled()
    })

    it('passes every other request on', () => {
      expect(request('/src/main.tsx').next).toHaveBeenCalled()
    })
  })
})
