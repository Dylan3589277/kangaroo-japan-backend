import { MigrationInterface, QueryRunner } from 'typeorm';

export class DepositTable1745800000000 implements MigrationInterface {
  name = 'DepositTable1745800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add deposit_balance to users (IF NOT EXISTS guards against re-run)
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "deposit_balance" numeric(12,2) NOT NULL DEFAULT 0
    `);

    // Create deposits table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "deposits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "type" character varying NOT NULL DEFAULT 'recharge',
        "order_no" character varying(64) NOT NULL,
        "payment_id" character varying,
        "remark" text,
        "refund_reason" text,
        "refunded_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_deposits_order_no" UNIQUE ("order_no"),
        CONSTRAINT "PK_deposits" PRIMARY KEY ("id"),
        CONSTRAINT "FK_deposits_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_deposits_user" ON "deposits" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_deposits_order_no" ON "deposits" ("order_no")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_deposits_status" ON "deposits" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_deposits_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_deposits_order_no"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_deposits_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "deposits"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "deposit_balance"`,
    );
  }
}
