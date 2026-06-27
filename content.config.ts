import { defineContentConfig, defineCollection, z } from '@nuxt/content'
import { defineSitemapSchema } from '@nuxtjs/sitemap/content'

export default defineContentConfig({
  collections: {
    legal: defineCollection({
      type: 'page',
      source: 'legal/*.md'
    }),
    docs: defineCollection({
      type: 'page',
      source: 'docs/**/*.md',
      schema: z.object({
        video: z.string().optional(),
        sitemap: defineSitemapSchema({ name: 'docs', z })
      })
    }),
    blog: defineCollection({
      type: 'page',
      source: 'blog/*.md',
      schema: z.object({
        date: z.string(),
        author: z.string().optional(),
        tags: z.array(z.string()).optional(),
        image: z.string().optional(),
        draft: z.boolean().optional(),
        sitemap: defineSitemapSchema({
          name: 'blog',
          z,
          filter: (entry) => {
            if (entry.draft) return false
            if (entry.date && new Date(entry.date) > new Date()) return false
            return true
          }
        })
      })
    })
  }
})
