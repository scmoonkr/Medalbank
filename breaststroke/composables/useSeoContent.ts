// composables/useSeoContent.ts — 페이지별 SEO 메타(title·description·og·twitter·JSON-LD)
// 사용: useSeoContent({ title, url: route.fullPath, description, type: 'article', image, site_name })
// url·image 가 상대 경로여도 runtimeConfig.public.siteUrl 을 붙여 절대 URL 로 내보낸다(og 는 절대 URL 이 필요).
import { useSeoMeta, useHead, useRuntimeConfig } from '#app'

export interface SeoOptions {
	title: string
	url: string
	description: string
	type: string
	image: string
	site_name: string
	keywords: string
	/** 발행일(ISO) — 있을 때만 JSON-LD 와 article:published_time 에 쓴다 */
	published?: string
	/** true 면 색인하지 않는다 */
	noindex?: boolean
}

export const useSeoContent = (options: Partial<SeoOptions>) => {
	const site = String(useRuntimeConfig().public.siteUrl || '').replace(/\/+$/, '')
	const abs = (u: string) => (/^https?:\/\//i.test(u) ? u : site + (u.startsWith('/') ? u : '/' + u))

	const title = options.title ?? ''
	// 쿼리스트링은 빼고 경로만 — canonical(plugins/seo.ts)과 같은 기준
	const url = abs((options.url ?? '/').split('?')[0].split('#')[0])
	const description = options.description ?? '평영 화이팅'
	const image = abs(options.image ?? '/images/brststrk_logo_meta.png')
	const siteName = options.site_name ?? '평영'
	const keywords = options.keywords ?? '#소속상관없이 #평영 #평영정기훈련 #평영클럽 #평영레슨 #평영스쿨 #평영학원 #평영화이팅'
	const robots = options.noindex ? 'noindex, nofollow' : 'index, follow'

	useSeoMeta({
		title,
		ogTitle: title,
		description,
		ogDescription: description,
		ogImage: image,
		ogImageWidth: 1200,
		ogImageHeight: 630,
		ogImageAlt: title,
		ogUrl: url,
		ogType: (options.type as any) ?? 'article',
		ogSiteName: siteName,
		twitterCard: 'summary_large_image',
		twitterTitle: title,
		twitterDescription: description,
		twitterImage: image,
		keywords,
		robots,
		...(options.published ? { articlePublishedTime: options.published } : {}),
	})

	useHead({
		meta: [{ name: 'theme-color', content: '#3B82F6' }],
		script: [{
			type: 'application/ld+json',
			// '<' 를 이스케이프해 제목에 </script> 가 들어 있어도 스크립트가 끊기지 않게 한다
			innerHTML: JSON.stringify({
				'@context': 'https://schema.org',
				'@type': 'Article',
				headline: title,
				image,
				description,
				url,
				mainEntityOfPage: url,
				...(options.published ? { datePublished: options.published } : {}),
				publisher: { '@type': 'Organization', name: siteName },
			}).replace(/</g, '\u003c'),
		}],
	})

	return { title, description, keywords, image }
}
