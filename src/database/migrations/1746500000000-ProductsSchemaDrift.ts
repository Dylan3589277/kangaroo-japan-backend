import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ProductsSchemaDrift1746500000000
 *
 * Fixes a schema drift between the old InitialSchema (1704067200000) and the
 * current Product entity. The InitialSchema created `products` with camelCase
 * columns (name, categoryId, price, reviewCount, isActive, createdAt, updatedAt,
 * images text[]). The ProductCategory migration (1713270500000) used
 * CREATE TABLE IF NOT EXISTS, so it was a no-op on existing DBs, leaving the
 * new snake_case columns absent.
 *
 * This migration is fully idempotent:
 *   - All ADD COLUMN statements use IF NOT EXISTS.
 *   - All CREATE INDEX statements use IF NOT EXISTS.
 *   - Backfills from old camelCase columns are guarded by DO $$ IF EXISTS blocks.
 *   - down() drops only the indexes introduced here; columns are never dropped.
 */
export class ProductsSchemaDrift1746500000000 implements MigrationInterface {
  name = 'ProductsSchemaDrift1746500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------ //
    // Phase 1 — Add all missing snake_case columns                        //
    // ------------------------------------------------------------------ //

    // Identity / platform
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "platform" varchar(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "platform_product_id" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "platform_url" text`,
    );

    // Multilingual titles
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "title_zh" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "title_en" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "title_ja" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "title_th" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "title_vi" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "title_id" text`,
    );

    // Multilingual descriptions
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "description_zh" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "description_en" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "description_ja" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "description_th" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "description_vi" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "description_id" text`,
    );

    // Pricing (nullable — no safe zero-default for price)
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "price_jpy" decimal(12,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "price_cny" decimal(12,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "price_usd" decimal(12,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "exchange_rate_used" decimal(10,6)`,
    );
    // currency already exists in old InitialSchema; ADD COLUMN IF NOT EXISTS is safe
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'JPY'`,
    );

    // Category FK (snake_case; old schema used camelCase "categoryId")
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "category_id" uuid`,
    );

    // Status — THE critical missing column causing the 500
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "status" varchar(50) DEFAULT 'active'`,
    );

    // Rating / counts
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "rating" decimal(3,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "images_count" integer DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "review_count" integer DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sales_count" integer DEFAULT 0`,
    );

    // Specifications / seller / misc
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "specifications" jsonb DEFAULT '{}'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "seller_name" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "seller_id" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "raw_data" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "last_synced_at" timestamp`,
    );

    // Timestamps (old schema used camelCase). Add without defaults first so
    // historical createdAt/updatedAt values can be backfilled before any
    // fallback now() value is applied to existing rows.
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "created_at" timestamp`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "updated_at" timestamp`,
    );

    // slug already exists in old InitialSchema (varchar, unique); safe no-op
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "slug" varchar(500)`,
    );

    // ------------------------------------------------------------------ //
    // Phase 2 — Fix `images` column type (text[] → jsonb)                //
    // Old InitialSchema: images text array                                //
    // Entity expects: images jsonb                                        //
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      DO $$ BEGIN
        -- Case A: column exists as ARRAY (old InitialSchema text[]) — convert to jsonb
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'products'
            AND column_name  = 'images'
            AND data_type    = 'ARRAY'
        ) THEN
          ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "_images_tmp" jsonb DEFAULT '[]'::jsonb;
          UPDATE "products" SET "_images_tmp" = to_jsonb("images") WHERE "images" IS NOT NULL;
          ALTER TABLE "products" DROP COLUMN "images";
          ALTER TABLE "products" RENAME COLUMN "_images_tmp" TO "images";

        -- Case B: column is missing entirely — add as jsonb
        ELSIF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'products'
            AND column_name  = 'images'
        ) THEN
          ALTER TABLE "products" ADD COLUMN "images" jsonb DEFAULT '[]'::jsonb;
        END IF;
        -- Case C: column already jsonb (ProductCategory ran on fresh DB) — nothing to do
      END $$;
    `);

    // ------------------------------------------------------------------ //
    // Phase 3 — Fix `rating` column precision                            //
    // Old InitialSchema: rating numeric(2,1) DEFAULT 0                  //
    // Entity expects:    rating decimal(3,2) nullable                    //
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'products'
            AND column_name  = 'rating'
            AND numeric_precision = 2
            AND numeric_scale     = 1
        ) THEN
          ALTER TABLE "products" ALTER COLUMN "rating" TYPE decimal(3,2) USING "rating"::decimal(3,2);
          ALTER TABLE "products" ALTER COLUMN "rating" DROP DEFAULT;
          ALTER TABLE "products" ALTER COLUMN "rating" DROP NOT NULL;
        END IF;
      END $$;
    `);

    // ------------------------------------------------------------------ //
    // Phase 4 — Backfill data from old camelCase columns                 //
    // All guards check information_schema before touching any data.      //
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      DO $$ BEGIN
        -- title_* from old "name" column
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name  = 'products'
            AND column_name = 'name'
        ) THEN
          UPDATE "products" SET "title_zh" = "name" WHERE "title_zh" IS NULL AND "name" IS NOT NULL;
          UPDATE "products" SET "title_ja" = "name" WHERE "title_ja" IS NULL AND "name" IS NOT NULL;
          UPDATE "products" SET "title_en" = "name" WHERE "title_en" IS NULL AND "name" IS NOT NULL;
        END IF;

        -- description_* from old "description" column
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name  = 'products'
            AND column_name = 'description'
        ) THEN
          UPDATE "products" SET "description_zh" = "description" WHERE "description_zh" IS NULL AND "description" IS NOT NULL;
          UPDATE "products" SET "description_ja" = "description" WHERE "description_ja" IS NULL AND "description" IS NOT NULL;
          UPDATE "products" SET "description_en" = "description" WHERE "description_en" IS NULL AND "description" IS NOT NULL;
        END IF;

        -- price_jpy from old "price" column
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name  = 'products'
            AND column_name = 'price'
        ) THEN
          UPDATE "products" SET "price_jpy" = "price" WHERE "price_jpy" IS NULL AND "price" IS NOT NULL;
        END IF;

        -- category_id from old camelCase "categoryId"
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name  = 'products'
            AND column_name = 'categoryId'
        ) THEN
          UPDATE "products" SET "category_id" = "categoryId" WHERE "category_id" IS NULL;
        END IF;

        -- review_count from old "reviewCount"
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name  = 'products'
            AND column_name = 'reviewCount'
        ) THEN
          UPDATE "products" SET "review_count" = "reviewCount" WHERE "review_count" = 0 AND "reviewCount" > 0;
        END IF;

        -- created_at from old "createdAt"
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name  = 'products'
            AND column_name = 'createdAt'
        ) THEN
          UPDATE "products" SET "created_at" = "createdAt" WHERE "created_at" IS NULL;
        END IF;

        -- updated_at from old "updatedAt"
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name  = 'products'
            AND column_name = 'updatedAt'
        ) THEN
          UPDATE "products" SET "updated_at" = "updatedAt" WHERE "updated_at" IS NULL;
        END IF;

        -- status from old "isActive" boolean
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name  = 'products'
            AND column_name = 'isActive'
        ) THEN
          UPDATE "products"
            SET "status" = CASE WHEN "isActive" THEN 'active' ELSE 'unavailable' END
          WHERE "status" IS NULL OR "status" = 'active';
        END IF;

        -- Fill fallback timestamp values only after old timestamp backfills ran.
        UPDATE "products" SET "created_at" = now() WHERE "created_at" IS NULL;
        UPDATE "products" SET "updated_at" = now() WHERE "updated_at" IS NULL;
      END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "created_at" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "updated_at" SET DEFAULT now()`,
    );

    // ------------------------------------------------------------------ //
    // Phase 5 — Indexes (all IF NOT EXISTS; no CONCURRENTLY)             //
    // Uses drift-specific index names so rollback will not drop indexes that
    // may have been created by earlier migrations with canonical names.                                                     //
    // ------------------------------------------------------------------ //

    // Single-column
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_drift_status"      ON "products"("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_drift_platform"    ON "products"("platform")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_drift_category"    ON "products"("category_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_drift_seller"      ON "products"("seller_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_drift_price_jpy"   ON "products"("price_jpy")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_drift_last_synced" ON "products"("last_synced_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_drift_rating_desc" ON "products"("rating" DESC) WHERE "rating" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_drift_sales_desc"  ON "products"("sales_count" DESC) WHERE "sales_count" > 0`,
    );

    // Composite (entity-declared)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_drift_status_platform" ON "products"("status", "platform")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_drift_status_category" ON "products"("status", "category_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_drift_status_price"    ON "products"("status", "price_jpy")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_drift_status_created"  ON "products"("status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_drift_status_rating"   ON "products"("status", "rating")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_drift_platform_status"   ON "products"("platform", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_drift_platform_category" ON "products"("platform", "category_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop only indexes introduced by this migration.
    // Columns are intentionally NOT dropped to avoid data loss.
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_products_drift_platform_category"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_products_drift_platform_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_products_drift_status_rating"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_products_drift_status_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_products_drift_status_price"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_products_drift_status_category"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_products_drift_status_platform"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_products_drift_sales_desc"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_products_drift_rating_desc"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_products_drift_last_synced"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_products_drift_price_jpy"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_drift_seller"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_products_drift_category"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_products_drift_platform"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_drift_status"`);
  }
}
