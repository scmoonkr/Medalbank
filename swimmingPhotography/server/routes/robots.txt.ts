export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return robotsTxt(siteUrlOf(event), ['/api/', '/login', '/signin', '/my/', '/videos', '/videoscard', '/images'])
})
