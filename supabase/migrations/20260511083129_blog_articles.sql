CREATE TABLE blog_articles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  content_html     TEXT NOT NULL DEFAULT '',
  content_markdown TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  image_url        TEXT,
  alt_text         TEXT,
  tags             JSONB NOT NULL DEFAULT '[]',
  author           TEXT,
  status           TEXT NOT NULL DEFAULT 'Draft',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_blog_articles_status ON blog_articles(status, created_at DESC);

CREATE TRIGGER blog_articles_updated_at
  BEFORE UPDATE ON blog_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE blog_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog_articles_public_select" ON blog_articles
  FOR SELECT USING (status = 'Published');

CREATE POLICY "blog_articles_service_role" ON blog_articles
  FOR ALL USING (auth.role() = 'service_role');
