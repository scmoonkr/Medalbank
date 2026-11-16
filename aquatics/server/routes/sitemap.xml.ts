export default defineCachedEventHandler((event) => {
  return sendXml(event, urlsetXml(siteUrlOf(event), [
    { loc: '/', changefreq: 'weekly', priority: 1.0 },
    { loc: '/about', changefreq: 'monthly', priority: 0.6 },
    { loc: '/athletes', changefreq: 'weekly', priority: 0.7 },
    { loc: '/photos', changefreq: 'weekly', priority: 0.7 },
    { loc: '/magazines', changefreq: 'weekly', priority: 0.7 },
  ]))
}, { maxAge: 60 * 60 })
