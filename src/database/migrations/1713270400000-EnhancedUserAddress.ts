import { MigrationInterface, QueryRunner } from "typeorm";

export class EnhancedUserAddress1713270400000 implements MigrationInterface {
  name = "EnhancedUserAddress1713270400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable uuid-ossp extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create enum types
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE user_role_enum AS ENUM ('user', 'admin');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE user_status_enum AS ENUM ('active', 'suspended', 'deleted');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE preferred_language_enum AS ENUM ('zh', 'en', 'ja');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE preferred_currency_enum AS ENUM ('CNY', 'USD', 'JPY');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE address_country_enum AS ENUM ('CN', 'JP', 'US', 'UK', 'AU', 'DE', 'FR', 'KR', 'TW', 'HK', 'SG', 'CA', 'OTHER');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE address_label_enum AS ENUM ('home', 'work', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Alter users table
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "phone" character varying(20) UNIQUE,
        ADD COLUMN IF NOT EXISTS "password_hash" character varying(255),
        ADD COLUMN IF NOT EXISTS "avatar_url" character varying(500),
        ADD COLUMN IF NOT EXISTS "status" user_status_enum DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS "phone_verified" boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS "preferred_language" preferred_language_enum DEFAULT 'zh',
        ADD COLUMN IF NOT EXISTS "preferred_currency" preferred_currency_enum DEFAULT 'CNY',
        ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP;
    `);

    // Drop old columns if they exist and rename
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "password"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "isActive"`);

    // Rename name column to be consistent
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "name" TO "name"`);

    // Alter addresses table - drop and recreate with new schema
    await queryRunner.query(`DROP TABLE IF EXISTS "addresses" CASCADE`);

    await queryRunner.query(`
      CREATE TABLE "addresses" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "recipient_name" character varying(100) NOT NULL,
        "phone" character varying(30) NOT NULL,
        "email" character varying(255),
        "country" address_country_enum DEFAULT 'CN',
        "address_line1" character varying(255) NOT NULL,
        "address_line2" character varying(255),
        "state" character varying(100),
        "state_code" character varying(20),
        "city" character varying(100) NOT NULL,
        "city_code" character varying(20),
        "district" character varying(100),
        "district_code" character varying(20),
        "postal_code" character varying(20),
        "full_address_text" jsonb,
        "label" address_label_enum DEFAULT 'home',
        "is_default" boolean DEFAULT false,
        "alternative_recipient_name" character varying(100),
        "alternative_phone" character varying(30),
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "FK_addresses_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for addresses
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_addresses_user_id" ON "addresses"("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_addresses_country" ON "addresses"("country")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_addresses_user_default" ON "addresses"("user_id", "is_default") WHERE "is_default" = true`);

    // Create function to ensure only one default address
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION ensure_single_default_address()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.is_default = true THEN
          UPDATE addresses
          SET is_default = false
          WHERE user_id = NEW.user_id AND id != NEW.id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger for default address enforcement
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS address_default_trigger ON addresses;
      CREATE TRIGGER address_default_trigger
      BEFORE INSERT OR UPDATE ON addresses
      FOR EACH ROW EXECUTE FUNCTION ensure_single_default_address();
    `);

    // Create function to auto-update updated_at
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create triggers for updated_at
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS update_addresses_updated_at ON addresses;
      CREATE TRIGGER update_addresses_updated_at
      BEFORE UPDATE ON addresses
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_addresses_updated_at ON addresses`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_users_updated_at ON users`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS address_default_trigger ON addresses`);

    // Drop functions
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS ensure_single_default_address()`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_addresses_user_default"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_addresses_country"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_addresses_user_id"`);

    // Drop addresses table
    await queryRunner.query(`DROP TABLE IF EXISTS "addresses" CASCADE`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS address_label_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS address_country_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS preferred_currency_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS preferred_language_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_role_enum`);

    // Revert users table - this is complex as we need to recreate original structure
    // In production, you would have a proper backup
  }
}
