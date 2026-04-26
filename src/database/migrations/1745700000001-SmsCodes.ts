import { MigrationInterface, QueryRunner } from 'typeorm';

export class SmsCodes1745700000001 implements MigrationInterface {
  name = 'SmsCodes1745700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sms_codes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "phone" character varying NOT NULL,
        "code" character varying NOT NULL,
        "type" character varying NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "expires_at" TIMESTAMP NOT NULL,
        "used" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sms_codes_phone_type" ON "sms_codes" ("phone", "type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sms_codes_phone_type"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sms_codes"`);
  }
}
