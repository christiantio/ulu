import type { Plugin } from 'vite'

/** Link-preview (Open Graph) image in public/, rendered from design/og-image.svg */
export const OG_IMAGE = { path: '/og-image.png', width: 1200, height: 630 }
const OG_IMAGE_ALT = 'Ulu: How ulu can you go? A route line from Raffles Place to Pedra Branca.'

/**
 * The site's origin from VITE_SITE_URL, e.g. https://ulu.sg, without a trailing slash. Unset or blank gives null
 * (local dev, CI); anything that isn't an http(s) origin is a mistake in the deploy config, so it throws.
 */
export function siteOrigin(value: string | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`VITE_SITE_URL must be an absolute URL like https://ulu.sg, got "${raw}"`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`VITE_SITE_URL must be an http(s) URL, got "${raw}"`)
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`VITE_SITE_URL must be the site's origin with no path, got "${raw}"`)
  }
  return url.origin
}

/**
 * Meta tags that need an absolute URL. Link-preview scrapers ignore relative ones, so without a site origin
 * og:url and og:image are left out entirely rather than emitted broken.
 */
export function absoluteMetaTags(origin: string | null): string[] {
  if (!origin) return []
  const image = `${origin}${OG_IMAGE.path}`
  return [
    `<meta property="og:url" content="${origin}/" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="${OG_IMAGE.width}" />`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}" />`,
    `<meta property="og:image:alt" content="${OG_IMAGE_ALT}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<meta name="twitter:image:alt" content="${OG_IMAGE_ALT}" />`,
  ]
}

/** Env placeholders (%VITE_…%) that survived into the HTML, which Vite leaves as-is when a variable is unset */
export function unreplacedPlaceholders(html: string): string[] {
  return html.match(/%VITE_[A-Z0-9_]*%/g) ?? []
}

const MARKER_LINE = /^([ \t]*)<!-- site-meta -->\n/m

/** Swap the <!-- site-meta --> line in index.html for the absolute tags (or nothing, without a site origin) */
export function injectSiteMeta(html: string, origin: string | null): string {
  if (!MARKER_LINE.test(html)) throw new Error('index.html is missing the <!-- site-meta --> marker')
  const tags = absoluteMetaTags(origin)
  return html.replace(MARKER_LINE, (_, indent: string) => tags.map((tag) => `${indent}${tag}\n`).join(''))
}

/**
 * Puts the absolute og:url and og:image tags where index.html has the site-meta marker, and fails the build if
 * the emitted HTML still has an unreplaced %VITE_…% placeholder.
 */
export function siteMeta(siteUrl: string | undefined): Plugin {
  const origin = siteOrigin(siteUrl)
  return {
    name: 'ulu:site-meta',
    transformIndexHtml: {
      order: 'post',
      handler: (html) => injectSiteMeta(html, origin),
    },
    // writeBundle, not generateBundle: Vite emits the HTML after the generateBundle hooks of plugins like this one
    writeBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.html')) continue
        const left = unreplacedPlaceholders(String(file.source))
        if (left.length > 0) this.error(`${file.fileName} has unreplaced env placeholders: ${left.join(', ')}`)
      }
    },
  }
}
