import { GlobalConfiguration } from "../../cfg"
import { QuartzEmitterPlugin } from "../types"
import path from "path"

export type ContentIndex = Map<string, ContentDetails>
export type ContentDetails = {
  title: string,
  links: string[],
  tags: string[],
  content: string,
  date?: Date,
  description?: string,
}

interface Options {
  enableSiteMap: boolean
  enableRSS: boolean
}

const defaultOptions: Options = {
  enableSiteMap: true,
  enableRSS: true,
}

function generateSiteMap(cfg: GlobalConfiguration, idx: ContentIndex): string {
  const base = cfg.canonicalUrl ?? ""
  const createURLEntry = (slug: string, content: ContentDetails): string => `<url>
    <loc>https://${base}/${slug}</loc>
    <lastmod>${content.date?.toISOString()}</lastmod>
  </url>`
  const urls = Array.from(idx).map(([slug, content]) => createURLEntry(slug, content)).join("")
  return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`
}

function generateRSSFeed(cfg: GlobalConfiguration, idx: ContentIndex): string {
  const base = cfg.canonicalUrl ?? ""
  const root = `https://${base}`

  // TODO: ogimage
  const createURLEntry = (slug: string, content: ContentDetails): string => `<items>
    <title>${content.title}</title>
    <link>${root}/${slug}</link>
    <guid>${root}/${slug}</guid>
    <description>${content.description}</description>
    <pubDate>${content.date?.toUTCString()}</pubDate>
  </items>`

  const items = Array.from(idx).map(([slug, content]) => createURLEntry(slug, content)).join("")
  return `<rss xmlns:atom="http://www.w3.org/2005/atom" version="2.0">
    <channel>
      <title>${cfg.pageTitle}</title>
      <link>${root}</link>
      <description>Recent content on ${cfg.pageTitle}</description>
      <generator>Quartz -- quartz.jzhao.xyz</generator>
      <atom:link href="${root}/index.xml" rel="self" type="application/rss+xml"/>
    </channel>
    ${items}
  </rss>`
}

export const ContentIndex: QuartzEmitterPlugin<Options> = (opts) => {
  opts = { ...defaultOptions, ...opts }
  return {
    name: "ContentIndex",
    async emit(_contentDir, cfg, content, _resources, emit) {
      const emitted: string[] = []
      const linkIndex: ContentIndex = new Map()
      for (const [_tree, file] of content) {
        const slug = file.data.slug!
        const date = file.data.dates?.modified ?? new Date()
        linkIndex.set(slug, {
          title: file.data.frontmatter?.title!,
          links: file.data.links ?? [],
          tags: file.data.frontmatter?.tags ?? [],
          content: file.data.text ?? "",
          date: date,
          description: file.data.description ?? ""
        })
      }

      if (opts?.enableSiteMap) {
        await emit({
          content: generateSiteMap(cfg, linkIndex),
          slug: "sitemap",
          ext: ".xml"
        })
        emitted.push("sitemap.xml")
      }

      if (opts?.enableRSS) {
        await emit({
          content: generateRSSFeed(cfg, linkIndex),
          slug: "index",
          ext: ".xml"
        })
        emitted.push("index.xml")
      }

      const fp = path.join("static", "contentIndex")
      const simplifiedIndex = Object.fromEntries(
        Array.from(linkIndex).map(([slug, content]) => {
          // remove description and from content index as nothing downstream
          // actually uses it. we only keep it in the index as we need it
          // for the RSS feed
          delete content.description
          delete content.date
          return [slug, content]
        })
      )
      await emit({
        content: JSON.stringify(simplifiedIndex),
        slug: fp,
        ext: ".json",
      })
      emitted.push(`${fp}.json`)

      return emitted
    },
    getQuartzComponents: () => [],
  }
}