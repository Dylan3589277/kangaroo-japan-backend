import { MigrationInterface, QueryRunner } from 'typeorm';

export class WarehouseTables1745700002000 implements MigrationInterface {
  name = 'WarehouseTables1745700002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 出库单表
    await queryRunner.query(`
      CREATE TABLE "shipment_orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_ids" text,
        "uid" character varying(36),
        "status" integer NOT NULL DEFAULT 0,
        "ship_way" character varying(50),
        "weight" numeric(10,2) NOT NULL DEFAULT 0,
        "post_fee" numeric(10,2) NOT NULL DEFAULT 0,
        "pack_fee" numeric(10,2) NOT NULL DEFAULT 0,
        "amount" numeric(12,2) NOT NULL DEFAULT 0,
        "amount_rmb" numeric(12,2) NOT NULL DEFAULT 0,
        "rate" numeric(10,6) NOT NULL DEFAULT 0,
        "realname" character varying(100),
        "mobile" character varying(20),
        "country" character varying(50),
        "province" character varying(50),
        "city" character varying(50),
        "address" text,
        "postcode" character varying(100),
        "remark" text,
        "value_added" text,
        "order_json" jsonb,
        "after_post_fee" numeric(10,2) NOT NULL DEFAULT 0,
        "over_time_fee" numeric(10,2) NOT NULL DEFAULT 0,
        "is_pay" integer NOT NULL DEFAULT 0,
        "out_trade_no" character varying(100),
        "store_days" integer NOT NULL DEFAULT 0,
        "last_update_mid" character varying(36),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shipment_orders" PRIMARY KEY ("id")
      )
    `);

    // 订单照片表
    await queryRunner.query(`
      CREATE TABLE "order_photos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" character varying(36),
        "uri" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_photos" PRIMARY KEY ("id")
      )
    `);

    // 索引
    await queryRunner.query(`
      CREATE INDEX "IDX_shipment_orders_uid" ON "shipment_orders" ("uid")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_shipment_orders_status" ON "shipment_orders" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_order_photos_order_id" ON "order_photos" ("order_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_order_photos_order_id"`);
    await queryRunner.query(`DROP INDEX "IDX_shipment_orders_status"`);
    await queryRunner.query(`DROP INDEX "IDX_shipment_orders_uid"`);
    await queryRunner.query(`DROP TABLE "order_photos"`);
    await queryRunner.query(`DROP TABLE "shipment_orders"`);
  }
}
