// 점검(준비중) 모드 — .env 의 BREASTSTROKE_MAINTENANCE=1 이면 /backend 와 그 로그인 경로를 뺀 모든 페이지를
// "준비중" 안내로 응답한다. 503 + Retry-After 라 검색엔진은 '일시 중단'으로 보고 색인을 유지한다.
// 해제: 값을 지우고 서버 재시작.
const PASS = [
  '/backend',                                   // 관리 화면
  '/auth/signin', '/auth/login_social', '/auth/auth',   // 관리자 로그인 경로
  '/_nuxt', '/__nuxt', '/_ipx', '/favicon', '/images', '/icons', '/forms', '/cms',   // 관리 화면이 쓰는 정적 자원
  '/robots.txt',                                // 크롤러 차단은 robots 라우트가 맡는다
]

const PAGE = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>준비중 — 평영</title>
<style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;background:#f8fafc;color:#1e293b;font-family:'Noto Sans KR',-apple-system,'Segoe UI',sans-serif}h1{font-size:28px;font-weight:700;margin:0}</style>
</head><body><h1>준비중입니다</h1></body></html>
`

export default defineEventHandler((event) => {
  const on = String(process.env.BREASTSTROKE_MAINTENANCE || '').toLowerCase()
  if (!['1', 'true', 'on', 'yes'].includes(on)) return
  const path = event.path.split('?')[0]
  if (PASS.some((p) => path === p || path.startsWith(p + '/') || (p === '/favicon' && path.startsWith('/favicon')))) return

  setResponseStatus(event, 503)
  setHeader(event, 'Retry-After', '86400')
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  return PAGE
})
