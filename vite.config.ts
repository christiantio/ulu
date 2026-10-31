import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { siteMeta } from './scripts/site-meta'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // VITE_SITE_URL can come from .env files or the host's build environment; loadEnv reads both
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), siteMeta(env.VITE_SITE_URL)],
  }
})
