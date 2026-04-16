import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderTables1745000000000 implements MigrationInterface {
  name = 'OrderTables1745000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create order_status enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "order_status" AS ENUM (
          'pending',
          'paid',
          'processing',
          'purchased',
          'shipped',
          'in_transit',
          'delivered',
          'cancelled',
          'refunded'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create orders table
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_no" varchar(50) UNIQUE NOT NULL,
        "user_id" uuid NOT NULL REFERENCES "users"("id"),
        "address_id" uuid NOT NULL REFERENCES "addresses"("id"),
        "status" "order_status" DEFAULT 'pending',
        "subtotal_jpy" decimal(12, 2) DEFAULT 0,
        "subtotal_cny" decimal(12, 2) DEFAULT 0,
        "subtotal_usd" decimal(12, 2) DEFAULT 0,
        "shipping_fee_jpy" decimal(12, 2) DEFAULT 0,
        "shipping_fee_cny" decimal(12, 2) DEFAULT 0,
        "service_fee_jpy" decimal(12, 2) DEFAULT 0,
        "service_fee_cny" decimal(12, 2) DEFAULT 0,
        "coupon_discount_cny" decimal(12, 2) DEFAULT 0,
        "total_amount" decimal(12, 2) NOT NULL,
        "total_currency" varchar(3) NOT NULL DEFAULT 'CNY',
        "payment_method" varchar(50),
        "payment_id" varchar(255),
        "paid_at" timestamp,
        "exchange_rate_used" decimal(10, 6),
        "buyer_message" text,
        "tracking_number" varchar(255),
        "shipping_carrier" varchar(100),
        "shipped_at" timestamp,
        "delivered_at" timestamp,
        "estimated_delivery" date,
        "created_at" timestamp DEFAULT NOW(),
        "updated_at" timestamp DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_orders_user" ON "orders" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_order_no" ON "orders" ("order_no")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_status" ON "orders" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_created" ON "orders" ("created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_tracking" ON "orders" ("tracking_number") WHERE "tracking_number" IS NOT NULL`,
    );

    // Create order_items table
    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "product_id" uuid NOT NULL REFERENCES "products"("id"),
        "platform" varchar(50) NOT NULL,
        "platform_product_id" varchar(255),
        "title_zh_snapshot" text,
        "title_en_snapshot" text,
        "title_ja_snapshot" text,
        "cover_image_url" varchar(500),
        "unit_price_jpy" decimal(12, 2) NOT NULL,
        "unit_price_cny" decimal(12, 2) NOT NULL,
        "quantity" integer NOT NULL DEFAULT 1,
        "subtotal_jpy" decimal(12, 2) NOT NULL,
        "subtotal_cny" decimal(12, 2) NOT NULL,
        "options" jsonb DEFAULT '{}',
        "seller_id" varchar(255),
        "seller_name" varchar(255),
        "status" varchar(50) DEFAULT 'pending',
        "tracking_number" varchar(255),
        "created_at" timestamp DEFAULT NOW(),
        "updated_at" timestamp DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_order_items_order" ON "order_items" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_order_items_product" ON "order_items" ("product_id")`,
    );

    // Create updated_at trigger function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Apply trigger to orders
    await queryRunner.query(`
      CREATE TRIGGER update_orders_updated_at
      BEFORE UPDATE ON orders
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    // Apply trigger to order_items
    await queryRunner.query(`
      CREATE TRIGGER update_order_items_updated_at
      BEFORE UPDATE ON order_items
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_order_items_updated_at ON order_items`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_orders_updated_at ON orders`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "order_status"`);
  }
}
