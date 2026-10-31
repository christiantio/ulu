/// <reference types="vite/client" />

// Build-time settings, all optional. See "Deploy settings" in README.md
interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string
  readonly VITE_ANALYTICS_PROVIDER?: string
  readonly VITE_ANALYTICS_SRC?: string
  readonly VITE_ANALYTICS_DOMAIN?: string
  readonly VITE_ANALYTICS_WEBSITE_ID?: string
  /**
   * The player report form's prefill URL, with {date}, {prompt}, {guesses} and {kind} placeholders. Unset means
   * the GitHub issue form (see src/game/report.ts)
   */
  readonly VITE_REPORT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
