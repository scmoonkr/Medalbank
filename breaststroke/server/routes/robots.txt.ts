export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  // 점검(준비중) 모드(server/middleware/maintenance.ts)에서는 크롤링을 멈추게 한다
  if (['1', 'true', 'on', 'yes'].includes(String(process.env.BREASTSTROKE_MAINTENANCE || '').toLowerCase())) return 'User-agent: *\nDisallow: /\n'
  return robotsTxt(siteUrlOf(event), ['/backend/', '/auth/', '/competitions/edit/', '/pools/edit/', '/teams/edit/', '/MB/simulations'])
})
