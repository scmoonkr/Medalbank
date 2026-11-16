export default defineCachedEventHandler((event) => {
  return sendXml(event, urlsetXml(siteUrlOf(event), [
    { loc: '/', changefreq: 'daily', priority: 1.0 },
    { loc: '/ledger', changefreq: 'daily', priority: 0.8 },
    { loc: '/canon', changefreq: 'weekly', priority: 0.7 },
    { loc: '/charter', changefreq: 'monthly', priority: 0.5 },
    { loc: '/errata', changefreq: 'weekly', priority: 0.5 },
    { loc: '/search', changefreq: 'monthly', priority: 0.4 },
  ]))
}, { maxAge: 60 * 60 })
