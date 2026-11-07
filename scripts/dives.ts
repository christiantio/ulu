import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import type { Schedule } from '../src/game/schedule'
import type { DiveFile, Pack, Prompt } from '../src/game/types'

/** Where a day's dive is served, relative to the site's base URL. src/content/index.ts fetches the same path */
export const diveFileName = (dateKey: string) => `dives/${dateKey}.json`

/**
 * One dive file per scheduled date, with that day's full prompts in schedule order. Throws if the schedule
 * lists a prompt that doesn't exist, so a broken schedule fails the build instead of shipping an empty day.
 */
export function diveFiles(prompts: readonly Prompt[], schedule: Schedule): Map<string, DiveFile> {
  const byId = new Map(prompts.map((p) => [p.id, p]))
  const files = new Map<string, DiveFile>()
  for (const date of Object.keys(schedule).sort()) {
    const day = schedule[date].map((id) => {
      const prompt = byId.get(id)
      if (!prompt) throw new Error(`schedule.json: ${date} lists "${id}", which isn't in any pack`)
      return prompt
    })
    files.set(date, { date, prompts: day })
  }
  return files
}

/** The packs and schedule under src/content, read from disk */
export function readContent(contentDir: string): { prompts: Prompt[]; schedule: Schedule } {
  const packDir = join(contentDir, 'packs')
  const prompts = readdirSync(packDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => (JSON.parse(readFileSync(join(packDir, f), 'utf8')) as Pack).prompts)
  const schedule: Schedule = JSON.parse(readFileSync(join(contentDir, 'schedule.json'), 'utf8'))
  return { prompts, schedule }
}

/** The date in a request for a dive file, e.g. "/dives/2026-11-03.json?t=1" (under any base), or null */
export function diveDateFromUrl(url: string): string | null {
  const { pathname } = new URL(url, 'http://localhost')
  return /(?:^|\/)dives\/(\d{4}-\d{2}-\d{2})\.json$/.exec(pathname)?.[1] ?? null
}

/**
 * Emits dives/<date>.json for every scheduled date, so the first load only fetches today's prompts and the
 * question bank stays out of the entry chunk. The dev server serves the same files from the current packs and
 * schedule, read on every request so content edits show up without a restart. `vite preview` serves them from
 * dist/ like any other file.
 */
export function dives(): Plugin {
  let contentDir = ''
  return {
    name: 'ulu:dives',
    configResolved(config) {
      contentDir = join(config.root, 'src', 'content')
    },
    generateBundle() {
      const { prompts, schedule } = readContent(contentDir)
      for (const [date, file] of diveFiles(prompts, schedule)) {
        this.emitFile({ type: 'asset', fileName: diveFileName(date), source: JSON.stringify(file) })
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const date = req.url ? diveDateFromUrl(req.url) : null
        if (!date) return next()
        const { prompts, schedule } = readContent(contentDir)
        const file = schedule[date] ? diveFiles(prompts, { [date]: schedule[date] }).get(date) : undefined
        // Answer a missing day with a 404 ourselves: Vite's SPA fallback would otherwise send index.html
        res.statusCode = file ? 200 : 404
        res.setHeader('Content-Type', file ? 'application/json' : 'text/plain')
        res.end(file ? JSON.stringify(file) : `No dive scheduled for ${date}`)
      })
    },
  }
}
