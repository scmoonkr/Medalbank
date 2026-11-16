// /sitemaps/static.xml · /sitemaps/athletes-2.xml · /sitemaps/competitions-1.xml · /sitemaps/pools-1.xml
export default defineCachedEventHandler(async (event) => {
  const site = siteUrlOf(event)
  const name = getRouterParam(event, 'name') ?? ''
  if (name === 'static') return sendXml(event, urlsetXml(site, STATIC_URLS))

  const m = /^([a-z]+)-(\d{1,4})$/.exec(name)
  const kind = m && KINDS.find((k) => k.key === m[1])
  if (!m || !kind) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  const rows = (await fetchPage(event, kind, Number(m[2]), CHUNK))?.data ?? []
  const urls: SitemapUrl[] = []
  for (const r of rows) {
    const id = r?.[kind.idField]
    if (id === undefined || id === null || id === '') continue
    urls.push({ loc: kind.path + encodeURIComponent(String(id)), lastmod: r.updatedAt, changefreq: 'weekly', priority: kind.priority })
  }
  return sendXml(event, urlsetXml(site, urls))
}, { maxAge: 60 * 60, getKey: (event) => 'sm:' + (getRouterParam(event, 'name') ?? '') })
