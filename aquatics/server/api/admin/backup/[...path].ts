// DB 백업·복원 — API 서버(6630)의 /api/admin/backup/* 로 그대로 넘긴다.
// zip(바이너리) 다운로드와 multipart 업로드, X-Backup-Key 헤더까지 스트림째 통과시킨다.
export default defineEventHandler((event) => {
  const path = getRouterParam(event, 'path') ?? ''
  return proxyRequest(event, `http://localhost:6630/api/admin/backup/${path}`)
})
