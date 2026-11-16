// breaststroke 사이트맵 데이터 — 공개 API(/BR/...)의 목록 POST 를 쪽 단위로 읽는다.
export const CHUNK = 5000   // 사이트맵 한 파일당 URL 수 (상한 50,000 보다 훨씬 작게)

export interface Kind { key: string; api: string; idField: string; path: string; priority: number }
export const KINDS: Kind[] = [
  { key: 'athletes',     api: '/BR/athletes',      idField: 'athleteID',     path: '/athletes/view/',     priority: 0.6 },
  { key: 'competitions', api: '/BR/competitions',  idField: 'competitionID', path: '/competitions/view/', priority: 0.6 },
  { key: 'pools',        api: '/poolsNew',         idField: 'poolID',        path: '/pools/view/',        priority: 0.4 },
]

export const STATIC_URLS: SitemapUrl[] = [
  { loc: '/', changefreq: 'daily', priority: 1.0 },
  { loc: '/athletes', changefreq: 'daily', priority: 0.8 },
  { loc: '/competitions/list', changefreq: 'daily', priority: 0.8 },
  { loc: '/pools/list', changefreq: 'weekly', priority: 0.5 },
  { loc: '/leaderboards', changefreq: 'daily', priority: 0.8 },
  { loc: '/statistics', changefreq: 'weekly', priority: 0.5 },
]

const apiBase = (event: any) => String(useRuntimeConfig(event).public.apiBase || '').replace(/\/+$/, '')

/** 목록 API 한 쪽 — { data: [...], count } */
export const fetchPage = (event: any, k: Kind, page: number, limit: number) =>
  $fetch<{ data?: any[]; count?: number }>(apiBase(event) + k.api, { method: 'POST', body: { page, limit } })

/** 전체 건수 — 응답에 count 가 없으면 1쪽 분량으로 본다 */
export const fetchCount = async (event: any, k: Kind): Promise<number> => {
  const r = await fetchPage(event, k, 1, 1)
  return Number(r?.count) || (r?.data?.length ? CHUNK : 0)
}
