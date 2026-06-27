ALTER TABLE blog_articles
  ADD COLUMN outrank_id TEXT;

CREATE UNIQUE INDEX idx_blog_articles_outrank_id
  ON blog_articles(outrank_id)
  WHERE outrank_id IS NOT NULL;
