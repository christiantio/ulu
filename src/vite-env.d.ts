/// <reference types="vite/client" />

// Build-time settings, all optional. See "Deploy settings" in README.md
interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string
  readonly VITE_ANALYTICS_PROVIDER?: string
  readonly VITE_ANALYTICS_SRC?: string
  readonly VITE_ANALYTICS_DOMAIN?: string
  readonly VITE_ANALYTICS_WEBSITE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
