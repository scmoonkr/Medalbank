export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return robotsTxt(siteUrlOf(event), ['/backend/', '/api/', '/cart', '/consent', '/verify'])
})
