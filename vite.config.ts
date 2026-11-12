import { loadEnv } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { dives } from './scripts/dives'
import { siteMeta } from './scripts/site-meta'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // VITE_SITE_URL can come from .env files or the host's build environment; loadEnv reads both
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), siteMeta(env.VITE_SITE_URL), dives()],
    test: {
      // The tests that play a whole game through take over 3 s on CI's shared runners, and a slow runner has
      // pushed one past the 5 s default
      testTimeout: 15_000,
      // prototypes/ are throwaway spikes with their own config, kept out of the main test run. Their READMEs
      // say how to run their tests
      exclude: [...configDefaults.exclude, 'prototypes/**'],
    },
  }
})
