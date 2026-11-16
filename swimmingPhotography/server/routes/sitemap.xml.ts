// 정적 페이지 + 게시된 기사(/article/<slug>) 전체. 기사는 통합 서버(6630)의 /sp/api/articles 에서 가져온다.
const STATIC: SitemapUrl[] = [
  { loc: '/', changefreq: 'hourly', priority: 1.0 },
  { loc: '/competitions', changefreq: 'daily', priority: 0.7 },
  { loc: '/breakingnews', changefreq: 'hourly', priority: 0.7 },
  { loc: '/introduction', changefreq: 'monthly', priority: 0.4 },
  { loc: '/search', changefreq: 'monthly', priority: 0.3 },
]
// 공개 기사 유형 — utils/articleList.ts 의 PUBLIC_TYPES 와 같아야 한다
const PUBLIC_TYPES = 'record,athlete,venue,notice,column'
const PAGE = 2000
const MAX_URLS = 50000   // 사이트맵 한 파일의 상한

export default defineCachedEventHandler(async (event) => {
  const site = siteUrlOf(event)
  const urls: SitemapUrl[] = [...STATIC]
  try {
    for (let skip = 0; urls.length < MAX_URLS; skip += PAGE) {
      const rows = await $fetch<any[]>('http://127.0.0.1:6630/sp/api/articles', {
        params: { type1: PUBLIC_TYPES, status: 'published', fields: 'card', limit: PAGE, skip },
      })
      if (!Array.isArray(rows) || !rows.length) break
      for (const d of rows) {
        if (!d?.slug) continue
        urls.push({
          loc: '/article/' + encodeURIComponent(d.slug),
          lastmod: d.updatedAt || d.publishedAt || d.createdAt,
          changefreq: 'monthly',
          priority: 0.8,
        })
      }
      if (rows.length < PAGE) break
    }
  } catch (e) {
    // 서버가 잠깐 응답하지 못해도 정적 페이지 목록은 내보낸다 (이 결과는 캐시 시간만큼 유지된다)
    console.error('[sitemap] articles 조회 실패:', (e as Error).message)
  }
  return sendXml(event, urlsetXml(site, urls))
}, { maxAge: 30 * 60 })
