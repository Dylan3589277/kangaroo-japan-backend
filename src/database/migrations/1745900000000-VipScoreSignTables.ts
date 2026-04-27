import { MigrationInterface, QueryRunner } from 'typeorm';

export class VipScoreSignTables1745900000000 implements MigrationInterface {
  name = 'VipScoreSignTables1745900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add VIP/score columns to users table
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "level" integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "level_end_time" TIMESTAMP
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "score" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "score_total" integer NOT NULL DEFAULT 0
    `);

    // user_levels table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_levels" (
        "id" serial NOT NULL,
        "name" character varying(50) NOT NULL,
        "level" integer NOT NULL,
        "price" numeric(10,2) NOT NULL,
        "image" character varying(500),
        "background_image" character varying(500),
        "privilege" text,
        "rate" numeric(5,2),
        "ship_rate" numeric(5,2),
        "store_days" integer,
        "fee" numeric(10,2),
        "over_time_fee" numeric(10,2),
        "is_deleted" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_levels" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_levels_level" ON "user_levels" ("level")`,
    );

    // vip_orders table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vip_orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "level" integer NOT NULL,
        "level_name" character varying(50) NOT NULL,
        "price" numeric(10,2) NOT NULL,
        "month" integer NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "offset_amount" numeric(10,2) NOT NULL DEFAULT 0,
        "out_trade_no" character varying(64) NOT NULL,
        "is_pay" boolean NOT NULL DEFAULT false,
        "pay_time" TIMESTAMP,
        "level_end_time" integer,
        "payment_id" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_vip_orders_out_trade_no" UNIQUE ("out_trade_no"),
        CONSTRAINT "PK_vip_orders" PRIMARY KEY ("id"),
        CONSTRAINT "FK_vip_orders_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_vip_orders_user" ON "vip_orders" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_vip_orders_out_trade_no" ON "vip_orders" ("out_trade_no")`,
    );

    // coupons table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "coupons" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "icon" character varying(500),
        "type" character varying(20) NOT NULL,
        "order_type" character varying(50),
        "data" numeric(10,2) NOT NULL,
        "condition" numeric(10,2) NOT NULL DEFAULT 0,
        "expire_days" integer NOT NULL DEFAULT 0,
        "stock" integer NOT NULL DEFAULT 0,
        "number" integer NOT NULL DEFAULT 0,
        "score" integer NOT NULL DEFAULT 0,
        "canbuy" boolean NOT NULL DEFAULT false,
        "act_type" character varying(30),
        "act_extras" jsonb,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coupons" PRIMARY KEY ("id")
      )
    `);

    // user_coupons table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_coupons" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "coupon_id" uuid NOT NULL,
        "code" character varying(64) NOT NULL,
        "type" character varying(20) NOT NULL,
        "order_type" character varying(50),
        "name" character varying(100) NOT NULL,
        "icon" character varying(500),
        "condition" numeric(10,2) NOT NULL DEFAULT 0,
        "data" numeric(10,2) NOT NULL,
        "expire" TIMESTAMP,
        "source" character varying(30) NOT NULL DEFAULT 'exchange',
        "used_at" TIMESTAMP,
        "order_id" character varying,
        "is_used" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_coupons_code" UNIQUE ("code"),
        CONSTRAINT "PK_user_coupons" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_coupons_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_coupons_coupon" FOREIGN KEY ("coupon_id")
          REFERENCES "coupons"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_coupons_user" ON "user_coupons" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_coupons_coupon" ON "user_coupons" ("coupon_id")`,
    );

    // score_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "score_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "amount" integer NOT NULL,
        "type" character varying(30) NOT NULL,
        "remark" text,
        "before_score" integer NOT NULL,
        "after_score" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_score_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_score_logs_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_score_logs_user" ON "score_logs" ("user_id")`,
    );

    // sign_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sign_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "sign_date" date NOT NULL,
        "day_index" integer NOT NULL,
        "score" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sign_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sign_logs_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sign_logs_user_date" ON "sign_logs" ("user_id", "sign_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sign_logs_user_date"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sign_logs"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_score_logs_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "score_logs"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_coupons_coupon"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_coupons_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_coupons"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "coupons"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_vip_orders_out_trade_no"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_vip_orders_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vip_orders"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_levels_level"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_levels"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "score_total"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "score"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "level_end_time"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "level"`);
  }
}
