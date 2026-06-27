import { serverSupabaseClient } from '#supabase/server'

interface BlogArticleSitemapRow {
  slug: string
  created_at: string
  updated_at: string
}

interface SitemapDatabase {
  public: {
    Tables: {
      blog_articles: {
        Row: BlogArticleSitemapRow
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export default defineSitemapEventHandler(async (event) => {
  const supabase = await serverSupabaseClient<SitemapDatabase>(event)

  const { data, error } = await supabase
    .from('blog_articles')
    .select('slug, created_at, updated_at')
    .eq('status', 'Published')
    .order('created_at', { ascending: false })
    .returns<BlogArticleSitemapRow[]>()

  if (error) {
    console.warn('[sitemap] Failed to load blog articles', error)
    return []
  }

  return (data ?? [])
    .filter((article) => article.slug)
    .map((article) => ({
      loc: `/blog/${article.slug}`,
      lastmod: article.updated_at ?? article.created_at,
    }))
})
