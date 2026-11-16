// 사이트맵 색인 — 정적 페이지 + 선수·대회·수영장을 CHUNK 건씩 나눈 하위 사이트맵
export default defineCachedEventHandler(async (event) => {
  const site = siteUrlOf(event)
  const paths = ['/sitemaps/static.xml']
  for (const k of KINDS) {
    let n = 1
    try { n = Math.max(1, Math.ceil((await fetchCount(event, k)) / CHUNK)) }
    catch (e) { console.error(`[sitemap] ${k.key} 건수 조회 실패:`, (e as Error).message) }
    for (let i = 1; i <= n; i++) paths.push(`/sitemaps/${k.key}-${i}.xml`)
  }
  return sendXml(event, sitemapIndexXml(site, paths))
}, { maxAge: 60 * 60 })
