import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentTables1745200000000 implements MigrationInterface {
  name = 'PaymentTables1745200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create payment_status enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payment_status" AS ENUM (
          'pending',
          'processing',
          'succeeded',
          'failed',
          'cancelled',
          'refunded'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create payment_method enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payment_method" AS ENUM (
          'stripe',
          'alipay',
          'wechat_pay'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create payment_provider enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payment_provider" AS ENUM (
          'stripe',
          'pingxx'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create currency enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "currency" AS ENUM (
          'CNY',
          'USD',
          'JPY'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create payments table
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "payment_no" varchar(64) UNIQUE NOT NULL,
        "order_id" uuid NOT NULL REFERENCES "orders"("id"),
        "user_id" uuid NOT NULL REFERENCES "users"("id"),
        "amount" decimal(12, 2) NOT NULL,
        "currency" "currency" NOT NULL DEFAULT 'CNY',
        "method" "payment_method" NOT NULL,
        "method_details" jsonb,
        "status" "payment_status" NOT NULL DEFAULT 'pending',
        "provider" "payment_provider" NOT NULL,
        "provider_payment_id" varchar(255),
        "paid_at" timestamp,
        "expired_at" timestamp,
        "refunded_at" timestamp,
        "refund_amount" decimal(12, 2),
        "refund_reason" text,
        "failure_message" text,
        "created_at" timestamp DEFAULT NOW(),
        "updated_at" timestamp DEFAULT NOW()
      )
    `);

    // Indexes
    await queryRunner.query(
      `CREATE INDEX "idx_payments_order" ON "payments" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payments_user" ON "payments" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payments_status" ON "payments" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payments_payment_no" ON "payments" ("payment_no")`,
    );

    // Add updated_at trigger
    await queryRunner.query(`
      CREATE TRIGGER update_payments_updated_at
      BEFORE UPDATE ON payments
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_payments_updated_at ON payments`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "payments" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "currency"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_provider"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_method"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_status"`);
  }
}
