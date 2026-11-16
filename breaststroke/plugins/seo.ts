// 모든 페이지 공통 — canonical / og:url. 쿼리스트링은 제외한 경로만 쓴다(필터·페이지 변형이 중복 색인되지 않도록).
export default defineNuxtPlugin(() => {
  const route = useRoute()
  const site = String(useRuntimeConfig().public.siteUrl || '').replace(/\/+$/, '')
  if (!site) return
  const url = computed(() => site + (route.path === '/' ? '/' : route.path.replace(/\/+$/, '')))
  useHead({
    link: [{ rel: 'canonical', href: url }],
    meta: [{ property: 'og:url', content: url }],
  })
})
