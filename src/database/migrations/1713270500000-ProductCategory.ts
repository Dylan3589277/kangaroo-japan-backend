import { MigrationInterface, QueryRunner } from "typeorm";

export class ProductCategory1713270500000 implements MigrationInterface {
  name = "ProductCategory1713270500000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable uuid-ossp extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create enum types
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE platform_enum AS ENUM ('amazon', 'mercari', 'rakuten', 'yahoo');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE product_status_enum AS ENUM ('active', 'trading', 'sold_out', 'unavailable');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create categories table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "parent_id" uuid,
        "level" integer DEFAULT 0,
        "sort_order" integer DEFAULT 0,
        "name_zh" character varying(100) NOT NULL,
        "name_en" character varying(100),
        "name_ja" character varying(100),
        "icon_url" character varying(500),
        "path" uuid[],
        "is_active" boolean DEFAULT true,
        "slug" character varying(100),
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "FK_categories_parent" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL
      )
    `);

    // Create indexes for categories
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_categories_parent" ON "categories"("parent_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_categories_slug" ON "categories"("slug")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_categories_active" ON "categories"("is_active") WHERE "is_active" = true`);

    // Create products table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "platform" platform_enum NOT NULL,
        "platform_product_id" character varying(255) NOT NULL,
        "platform_url" text,
        
        -- 多语言标题
        "title_zh" text,
        "title_en" text,
        "title_ja" text,
        
        -- 多语言描述
        "description_zh" text,
        "description_en" text,
        "description_ja" text,
        
        -- 价格 (JPY 基准)
        "price_jpy" decimal(12, 2) NOT NULL,
        "price_cny" decimal(12, 2),
        "price_usd" decimal(12, 2),
        "exchange_rate_used" decimal(10, 6),
        
        -- 属性
        "currency" character varying(3) DEFAULT 'JPY',
        "category_id" uuid,
        "images" jsonb DEFAULT '[]'::jsonb,
        "images_count" integer DEFAULT 0,
        
        -- 状态
        "status" product_status_enum DEFAULT 'active',
        
        -- 评分与销量
        "rating" decimal(3, 2),
        "review_count" integer DEFAULT 0,
        "sales_count" integer DEFAULT 0,
        
        -- 规格参数
        "specifications" jsonb DEFAULT '{}'::jsonb,
        
        -- 卖家信息
        "seller_name" character varying(255),
        "seller_id" character varying(255),
        
        -- SEO字段
        "slug" character varying(500),
        
        -- 原始数据备份
        "raw_data" jsonb,
        
        -- 同步时间
        "last_synced_at" TIMESTAMP,
        
        -- 时间戳
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        
        CONSTRAINT "FK_products_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_products_platform_product" UNIQUE ("platform", "platform_product_id")
      )
    `);

    // Create indexes for products
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_products_platform" ON "products"("platform")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_products_category" ON "products"("category_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_products_status" ON "products"("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_products_rating" ON "products"("rating" DESC) WHERE "rating" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_products_sales" ON "products"("sales_count" DESC) WHERE "sales_count" > 0`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_products_price" ON "products"("price_jpy")`);

    // Create price_history table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "price_history" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "product_id" uuid NOT NULL,
        "price_jpy" decimal(12, 2) NOT NULL,
        "price_cny" decimal(12, 2),
        "price_usd" decimal(12, 2),
        "exchange_rate" decimal(10, 6),
        "recorded_at" TIMESTAMP DEFAULT now(),
        "platform_status" character varying(50),
        "created_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "FK_price_history_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_price_history_product_recorded" UNIQUE ("product_id", "recorded_at")
      )
    `);

    // Create indexes for price_history
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_price_history_product" ON "price_history"("product_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_price_history_recorded" ON "price_history"("recorded_at" DESC)`);

    // Create updated_at trigger
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger for products
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS update_products_updated_at ON products;
      CREATE TRIGGER update_products_updated_at
      BEFORE UPDATE ON products
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create trigger for categories
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
      CREATE TRIGGER update_categories_updated_at
      BEFORE UPDATE ON categories
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_categories_updated_at ON categories`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_products_updated_at ON products`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column()`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_price_history_recorded"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_price_history_product"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_price"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_sales"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_rating"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_platform"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_categories_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_categories_slug"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_categories_parent"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "price_history" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories" CASCADE`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS product_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS platform_enum`);
  }
}
