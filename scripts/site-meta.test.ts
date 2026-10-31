import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { absoluteMetaTags, injectSiteMeta, siteOrigin, unreplacedPlaceholders } from './site-meta'

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

describe('siteOrigin', () => {
  it('is null when VITE_SITE_URL is unset or blank', () => {
    expect(siteOrigin(undefined)).toBeNull()
    expect(siteOrigin('')).toBeNull()
    expect(siteOrigin('  ')).toBeNull()
  })

  it('normalises to the origin without a trailing slash', () => {
    expect(siteOrigin('https://ulu.sg')).toBe('https://ulu.sg')
    expect(siteOrigin('https://ulu.sg/')).toBe('https://ulu.sg')
    expect(siteOrigin(' https://Ulu.SG ')).toBe('https://ulu.sg')
  })

  it('rejects anything that is not an http(s) origin', () => {
    expect(() => siteOrigin('ulu.sg')).toThrow(/absolute URL/)
    expect(() => siteOrigin('ftp://ulu.sg')).toThrow(/http\(s\)/)
    expect(() => siteOrigin('https://ulu.sg/play')).toThrow(/no path/)
  })
})

describe('index.html link previews', () => {
  it('has the static Open Graph and Twitter tags', () => {
    for (const tag of ['og:title', 'og:description', 'og:type']) expect(indexHtml).toContain(`property="${tag}"`)
    expect(indexHtml).toContain('<meta name="twitter:card" content="summary_large_image" />')
    expect(unreplacedPlaceholders(indexHtml)).toEqual([])
  })

  it('adds absolute og:url and og:image when the site origin is known', () => {
    const html = injectSiteMeta(indexHtml, 'https://ulu.sg')
    expect(html).toContain('    <meta property="og:url" content="https://ulu.sg/" />\n')
    expect(html).toContain('<meta property="og:image" content="https://ulu.sg/og-image.png" />')
    expect(html).toContain('<meta property="og:image:width" content="1200" />')
    expect(html).toContain('<meta property="og:image:height" content="630" />')
    expect(html).not.toContain('<!-- site-meta -->')
  })

  it('leaves og:url and og:image out without a site origin', () => {
    expect(absoluteMetaTags(null)).toEqual([])
    const html = injectSiteMeta(indexHtml, null)
    expect(html).not.toContain('property="og:url"')
    expect(html).not.toMatch(/property="og:image|twitter:image/)
    expect(html).not.toContain('<!-- site-meta -->')
    expect(html).toContain('<meta property="og:title"')
  })

  it('finds env placeholders Vite left unreplaced', () => {
    expect(unreplacedPlaceholders('<title>%VITE_SITE_URL% and %VITE_X%</title>')).toEqual([
      '%VITE_SITE_URL%',
      '%VITE_X%',
    ])
    expect(unreplacedPlaceholders('<title>100% VITE_</title>')).toEqual([])
  })
})
