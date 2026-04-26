import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserProviders1745700000000 implements MigrationInterface {
  name = 'UserProviders1745700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_providers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "provider" character varying NOT NULL DEFAULT 'wechat',
        "provider_user_id" character varying NOT NULL,
        "unionid" character varying,
        "type" character varying,
        "name" character varying,
        "avatar_url" character varying,
        "session_code" character varying,
        "session_key_encrypted" character varying,
        "raw_metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_providers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_providers_provider_userid" UNIQUE ("provider", "provider_user_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_providers_user_id" ON "user_providers" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_providers_provider_userid" ON "user_providers" ("provider", "provider_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_provider_userid"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_providers"`);
  }
}
