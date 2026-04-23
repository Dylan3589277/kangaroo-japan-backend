import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1745300000000 implements MigrationInterface {
  name = 'AddPerformanceIndexes1745300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Product indexes
    await queryRunner.query(`
      CREATE INDEX idx_products_seller ON products(seller_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_products_platform_status ON products(platform, status)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_products_platform_category ON products(platform, category_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_products_price_jpy ON products(price_jpy)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_products_last_synced ON products(last_synced_at)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_products_rating ON products(rating)
    `);

    // Order indexes
    await queryRunner.query(`
      CREATE INDEX idx_orders_user ON orders(user_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_orders_status ON orders(status)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_orders_created_at ON orders(created_at)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_orders_user_status ON orders(user_id, status)
    `);

    // OrderItem indexes
    await queryRunner.query(`
      CREATE INDEX idx_order_items_order ON order_items(order_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_order_items_product ON order_items(product_id)
    `);

    // Cart indexes
    await queryRunner.query(`
      CREATE INDEX idx_carts_user ON carts(user_id)
    `);

    // User indexes
    await queryRunner.query(`
      CREATE INDEX idx_users_email ON users(email)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_users_phone ON users(phone)
    `);

    // Address indexes
    await queryRunner.query(`
      CREATE INDEX idx_addresses_user ON addresses(user_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Product indexes
    await queryRunner.query(`DROP INDEX idx_products_seller`);
    await queryRunner.query(`DROP INDEX idx_products_platform_status`);
    await queryRunner.query(`DROP INDEX idx_products_platform_category`);
    await queryRunner.query(`DROP INDEX idx_products_price_jpy`);
    await queryRunner.query(`DROP INDEX idx_products_last_synced`);
    await queryRunner.query(`DROP INDEX idx_products_rating`);

    // Order indexes
    await queryRunner.query(`DROP INDEX idx_orders_user`);
    await queryRunner.query(`DROP INDEX idx_orders_status`);
    await queryRunner.query(`DROP INDEX idx_orders_created_at`);
    await queryRunner.query(`DROP INDEX idx_orders_user_status`);

    // OrderItem indexes
    await queryRunner.query(`DROP INDEX idx_order_items_order`);
    await queryRunner.query(`DROP INDEX idx_order_items_product`);

    // Cart indexes
    await queryRunner.query(`DROP INDEX idx_carts_user`);

    // User indexes
    await queryRunner.query(`DROP INDEX idx_users_email`);
    await queryRunner.query(`DROP INDEX idx_users_phone`);

    // Address indexes
    await queryRunner.query(`DROP INDEX idx_addresses_user`);
  }
}
