-- products-schema-check.sql
-- READ-ONLY diagnostic queries for the products table.
-- Run these before applying 1746500000000-ProductsSchemaDrift to understand
-- the current state. Do NOT run any write operations from this file.
--
-- Usage:
--   psql "$DATABASE_URL" -f docs/database/products-schema-check.sql
-- or paste individual sections into your DB console.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. All columns currently in the products table
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  character_maximum_length,
  numeric_precision,
  numeric_scale,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'products'
ORDER BY ordinal_position;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Check for the critical missing columns that cause the 500 error
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  col AS required_column,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'products'
      AND column_name  = col
  ) AS exists
FROM (VALUES
  ('status'),
  ('platform'),
  ('platform_product_id'),
  ('platform_url'),
  ('price_jpy'),
  ('category_id'),
  ('images_count'),
  ('review_count'),
  ('sales_count'),
  ('exchange_rate_used'),
  ('title_zh'),
  ('title_en'),
  ('title_ja'),
  ('title_th'),
  ('title_vi'),
  ('title_id'),
  ('description_zh'),
  ('description_en'),
  ('description_ja'),
  ('description_th'),
  ('description_vi'),
  ('description_id'),
  ('seller_name'),
  ('seller_id'),
  ('specifications'),
  ('raw_data'),
  ('last_synced_at'),
  ('created_at'),
  ('updated_at'),
  ('currency'),
  ('slug')
) AS t(col);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Check for old camelCase columns from InitialSchema (drift sources)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  col AS old_camelcase_column,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'products'
      AND column_name  = col
  ) AS exists
FROM (VALUES
  ('name'),
  ('description'),
  ('price'),
  ('categoryId'),
  ('reviewCount'),
  ('isActive'),
  ('createdAt'),
  ('updatedAt'),
  ('stock')
) AS t(col);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Type of the `images` column (old = ARRAY, new = jsonb)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'products'
  AND column_name  = 'images';


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. All indexes on the products table
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  i.relname AS index_name,
  ix.indisunique AS is_unique,
  pg_get_indexdef(ix.indexrelid) AS definition
FROM pg_class t
JOIN pg_index ix    ON t.oid = ix.indrelid
JOIN pg_class i     ON i.oid = ix.indexrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE t.relname = 'products'
  AND n.nspname = 'public'
  AND t.relkind = 'r'
ORDER BY i.relname;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. TypeORM migration history (which migrations have run)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT name, timestamp
FROM typeorm_migrations
ORDER BY timestamp;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Row count (sanity check — confirms products table exists and has data)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT COUNT(*) AS total_products FROM "products";
