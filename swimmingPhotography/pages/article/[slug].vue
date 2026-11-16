<script setup lang="ts">
// 기사 상세(동적) — /article/<slug> : articles 컬렉션에서 slug 로 문서를 가져와 렌더.
// 문서 JSON → HTML(buildArticleLayout) → v-html, 상호작용은 wireArticleInteractions 로 공유.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import '~/assets/css/article.css'
import { buildArticleLayout, type RelatedItem } from '~/utils/articleHtml'
import { catKo, articleDate, PUBLIC_TYPES } from '~/utils/articleList'
import { wireArticleInteractions, type ArticleWiring } from '~/utils/articleInteractions'

const route = useRoute()
const slug = computed(() => String(route.params.slug || ''))

// slug 로 문서 조회 (+ 같은 대회 최근 기사)
const { data, error } = await useAsyncData(
  () => 'article:' + slug.value,
  async () => {
    const list = await $fetch<any[]>('/api/articles', { params: { slug: slug.value, limit: 1 } })
    const doc = (list && list[0]) || null
    if (!doc) return { doc: null, related: [] as RelatedItem[] }
    // 같은 대회(없으면 최근) 기사 목록 — 현재 글 제외
    let related: RelatedItem[] = []
    try {
      const others = await $fetch<any[]>('/api/articles', { params: { type1: PUBLIC_TYPES, status: 'published', limit: 12 } })
      related = (others || [])
        .filter((d) => d.slug && d.slug !== slug.value)
        .slice(0, 5)
        .map((d) => ({
          slug: d.slug,
          category: catKo(d.translations?.ko?.categories),
          title: d.translations?.ko?.title || '',
          region: '',
          date: articleDate(d),
          thumb: d?.media?.thumb || d?.media?.coverImage || (d?.media?.images && d.media.images[0]?.url) || '',
        }))
    } catch {}
    return { doc, related }
  },
  { watch: [slug] },
)

const doc = computed<any>(() => data.value?.doc || null)
const html = computed(() => {
  if (!doc.value) return ''
  return buildArticleLayout(doc.value, {
    related: data.value?.related || [],
    relatedHeading: '최근 기사',
    moreHref: '/search',
    cloudPublicUrl: useRuntimeConfig().public.cloudPublicUrl,
  })
})

// 기사를 못 찾으면 404 로 응답 — 빈 페이지가 200 으로 색인되지 않게 한다
if (import.meta.server && !doc.value) setResponseStatus(useRequestEvent()!, 404)

// ── SEO: title·description·og·article:*·JSON-LD(NewsArticle) ──
const siteUrl = String(useRuntimeConfig().public.siteUrl || '').replace(/\/+$/, '')
const absImg = (u?: string) => {
  if (!u) return ''
  if (/^https?:\/\//i.test(u)) return u
  const base = String(useRuntimeConfig().public.cloudPublicUrl || '').replace(/\/+$/, '')
  return u.startsWith('/') && !base ? siteUrl + u : base + '/' + u.replace(/^\/+/, '')
}
const iso = (v: any) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined }

useHead(() => {
  const d = doc.value
  const ko = d?.translations?.ko
  const title = ko?.seoTitle || ko?.title
  const fullTitle = title ? `${title} — Swimming Photography` : 'Swimming Photography'
  const desc = String(ko?.seoDescription || ko?.excerpt || '').trim()
  const image = absImg(d?.media?.coverImage || d?.media?.thumb || d?.media?.images?.[0]?.url)
  const url = `${siteUrl}/article/${encodeURIComponent(slug.value)}`
  const published = iso(d?.publishedAt || d?.createdAt)
  const modified = iso(d?.updatedAt) || published
  const meta: any[] = [
    { name: 'description', content: desc },
    { property: 'og:type', content: 'article' },
    { property: 'og:site_name', content: 'Swimming Photography' },
    { property: 'og:title', content: title || 'Swimming Photography' },
    { property: 'og:description', content: desc },
    { property: 'og:url', content: url },
    { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' },
  ]
  if (image) meta.push({ property: 'og:image', content: image }, { name: 'twitter:image', content: image })
  if (published) meta.push({ property: 'article:published_time', content: published })
  if (modified) meta.push({ property: 'article:modified_time', content: modified })
  if (!d) meta.push({ name: 'robots', content: 'noindex' })
  const ld = d ? {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: title || '',
    description: desc || undefined,
    image: image ? [image] : undefined,
    datePublished: published,
    dateModified: modified,
    mainEntityOfPage: url,
    author: d?.reporter?.name ? { '@type': 'Person', name: d.reporter.name } : { '@type': 'Organization', name: 'Swimming Photography' },
    publisher: { '@type': 'Organization', name: 'Swimming Photography' },
  } : null
  return {
    title: fullTitle,
    meta,
    script: ld ? [{ type: 'application/ld+json', innerHTML: JSON.stringify(ld).replace(/</g, '\\u003c') }] : [],
  }
})

// ── 렌더 후 상호작용 wiring ──
const root = ref<HTMLElement | null>(null)
let wiring: ArticleWiring | null = null

// 진입 시 로고·헤더를 지나 본문 첫 줄(브레드크럼)부터 보이도록 한 칸 내린다.
// 브레드크럼과 사이드바 '자세히 보기' 는 같은 높이에서 시작하므로 둘이 함께 맨 위에 온다.
const scrollToArticleTop = () => {
  if (!import.meta.client) return
  if (window.location.hash) return              // 앵커로 들어왔으면 그 위치를 존중한다
  const align = () => {
    const el = root.value?.querySelector<HTMLElement>('.breadcrumb')
    if (!el) return
    // 사이드바는 sticky(top:20px) 라 화면 맨 위에 붙이면 '자세히 보기' 가 20px 아래에 걸린다.
    // 브레드크럼을 그 높이에 맞춰야 둘이 같은 선에 놓인다.
    const side = root.value?.querySelector<HTMLElement>('.sidebar')
    const stickyTop = side ? (parseFloat(getComputedStyle(side).top) || 0) : 0
    const y = el.getBoundingClientRect().top + window.scrollY - stickyTop
    window.scrollTo({ top: Math.max(0, Math.round(y)), behavior: 'auto' })
  }
  // 상단 속보 티커가 마운트 뒤에 들어오면서 38px 만큼 밀린다 — 자리가 잡힌 뒤 한 번 더 맞춘다.
  requestAnimationFrame(align)
  setTimeout(align, 400)
}

const teardown = () => { wiring?.cleanup(); wiring = null }
const wire = async () => {
  await nextTick()
  if (!root.value || !html.value) return
  teardown()
  wiring = wireArticleInteractions(root.value)
  scrollToArticleTop()
}

// 마운트 후 1회 wiring(초기 로드·하이드레이션) + slug/데이터 변경 시 재구성.
// (watch 의 immediate 는 마운트 전에 돌아 root 가 아직 없고, 하이드레이션 시 html 이
//  변하지 않아 재실행되지 않으므로 onMounted 로 초기 wiring 을 보장한다.)
onMounted(wire)
watch(html, wire)
onBeforeUnmount(teardown)
</script>

<template>
  <div v-if="doc" ref="root" class="article-page" v-html="html" />
  <div v-else class="article-missing">
    <p>기사를 찾을 수 없습니다.</p>
    <NuxtLink to="/">홈으로</NuxtLink>
  </div>
</template>

<style scoped>
.article-missing { max-width: 640px; margin: 80px auto; text-align: center; font-family: var(--serif); color: var(--ink-mute); }
.article-missing a { color: var(--orange); }
</style>
