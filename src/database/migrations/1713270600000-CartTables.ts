import { MigrationInterface, QueryRunner } from 'typeorm';

export class CartTables1713270600000 implements MigrationInterface {
  name = 'CartTables1713270600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop old cart_items table if it exists (from previous schema)
    await queryRunner.query(`DROP TABLE IF EXISTS "cart_items_old" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cart_items" CASCADE`);

    // Create carts table
    await queryRunner.query(`
      CREATE TABLE "carts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid UNIQUE NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "total_items" integer DEFAULT 0,
        "subtotal_jpy" decimal(12, 2) DEFAULT 0,
        "subtotal_cny" decimal(12, 2) DEFAULT 0,
        "subtotal_usd" decimal(12, 2) DEFAULT 0,
        "exchange_rate_used" decimal(10, 6),
        "preferred_currency" varchar(3) DEFAULT 'CNY',
        "created_at" timestamp DEFAULT NOW(),
        "updated_at" timestamp DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_carts_user" ON "carts" ("user_id")`,
    );

    // Create cart_items table
    await queryRunner.query(`
      CREATE TABLE "cart_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "cart_id" uuid NOT NULL REFERENCES "carts"("id") ON DELETE CASCADE,
        "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
        "quantity" integer NOT NULL DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 5),
        "price_at_add_jpy" decimal(12, 2) NOT NULL,
        "price_at_add_cny" decimal(12, 2),
        "price_at_add_usd" decimal(12, 2),
        "options" jsonb,
        "buyer_message" varchar(200),
        "status" varchar(20) DEFAULT 'active',
        "seller_id" varchar(255),
        "seller_name" varchar(255),
        "created_at" timestamp DEFAULT NOW(),
        "updated_at" timestamp DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_cart_items_cart" ON "cart_items" ("cart_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_cart_items_product" ON "cart_items" ("product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_cart_items_seller" ON "cart_items" ("seller_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cart_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "carts" CASCADE`);
  }
}
