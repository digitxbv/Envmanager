import { createClient } from '@supabase/supabase-js'

interface OutrankArticle {
  id: string
  title: string
  slug: string
  content_html: string
  content_markdown: string
  meta_description: string
  image_url?: string
  tags?: string[]
  author?: string
}

interface OutrankPublishPayload {
  event_type: 'publish_articles'
  timestamp?: string
  data: { articles: OutrankArticle[] }
}

interface OutrankUpdatePayload {
  event_type: 'update_article'
  timestamp?: string
  data: { article: OutrankArticle }
}

type OutrankPayload = OutrankPublishPayload | OutrankUpdatePayload

function toRow(a: OutrankArticle) {
  return {
    outrank_id: a.id,
    slug: a.slug,
    title: a.title,
    content_html: a.content_html ?? '',
    content_markdown: a.content_markdown ?? '',
    meta_description: a.meta_description ?? '',
    image_url: a.image_url || null,
    tags: a.tags ?? [],
    author: a.author?.trim() || 'EnvManager Team',
    status: 'Published',
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const authHeader = getHeader(event, 'authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token || token !== config.outrankWebhookSecret) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody<OutrankPayload>(event)

  let rows: ReturnType<typeof toRow>[] = []
  if (body?.event_type === 'publish_articles') {
    const articles = body.data?.articles
    if (!Array.isArray(articles) || articles.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'No articles in payload' })
    }
    rows = articles.map(toRow)
  } else if (body?.event_type === 'update_article') {
    const article = body.data?.article
    if (!article?.id) {
      throw createError({ statusCode: 400, statusMessage: 'No article in payload' })
    }
    rows = [toRow(article)]
  } else {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported event_type' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseSecretKey) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase not configured' })
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey)

  const { error } = await supabase.from('blog_articles').upsert(rows, {
    onConflict: 'outrank_id',
    ignoreDuplicates: false,
  })

  if (error) {
    console.error('Outrank webhook upsert error:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to save articles' })
  }

  return { message: 'Webhook processed successfully' }
})
