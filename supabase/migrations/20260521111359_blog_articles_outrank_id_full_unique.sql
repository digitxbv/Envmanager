-- Replace partial unique index with a regular UNIQUE constraint so it can
-- serve as an ON CONFLICT inference target for upserts.
DROP INDEX IF EXISTS idx_blog_articles_outrank_id;

ALTER TABLE blog_articles
  ADD CONSTRAINT blog_articles_outrank_id_key UNIQUE (outrank_id);
