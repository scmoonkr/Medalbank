// SEO 공용 — robots.txt / sitemap.xml 생성 도우미 (Nitro server/utils 자동 import)
import type { H3Event } from 'h3'

/** 사이트 기준 URL(끝 슬래시 제거). nuxt.config 의 runtimeConfig.public.siteUrl */
export const siteUrlOf = (event: H3Event): string =>
  String(useRuntimeConfig(event).public.siteUrl || '').replace(/\/+$/, '')

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const iso = (v: unknown): string | null => {
  if (!v) return null
  const d = new Date(v as any)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export interface SitemapUrl {
  loc: string
  lastmod?: unknown
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
}

/** loc 는 '/path' 또는 절대 URL. 절대 URL 이 아니면 site 를 앞에 붙인다. */
export const urlsetXml = (site: string, urls: SitemapUrl[]): string => {
  const body = urls.map((u) => {
    const loc = /^https?:\/\//i.test(u.loc) ? u.loc : site + (u.loc.startsWith('/') ? u.loc : '/' + u.loc)
    const lm = iso(u.lastmod)
    return '  <url>'
      + `<loc>${esc(loc)}</loc>`
      + (lm ? `<lastmod>${lm}</lastmod>` : '')
      + (u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : '')
      + (u.priority !== undefined ? `<priority>${u.priority.toFixed(1)}</priority>` : '')
      + '</url>'
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

/** 사이트맵 색인 — 하위 사이트맵이 여러 개일 때 */
export const sitemapIndexXml = (site: string, paths: string[]): string => {
  const body = paths.map((p) => `  <sitemap><loc>${esc(site + p)}</loc></sitemap>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`
}

export const sendXml = (event: H3Event, xml: string) => {
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return xml
}

/** robots.txt — 모든 크롤러에 disallow 경로를 막고 sitemap 위치를 알린다 */
export const robotsTxt = (site: string, disallow: string[]): string =>
  ['User-agent: *', ...(disallow.length ? disallow.map((p) => `Disallow: ${p}`) : ['Disallow:']), '', `Sitemap: ${site}/sitemap.xml`, ''].join('\n')
