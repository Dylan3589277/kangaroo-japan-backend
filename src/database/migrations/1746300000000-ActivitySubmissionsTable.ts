import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActivitySubmissionsTable1746300000000 implements MigrationInterface {
  name = 'ActivitySubmissionsTable1746300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建枚举类型
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_submissions_status_enum') THEN
          CREATE TYPE activity_submissions_status_enum AS ENUM ('pending', 'approved', 'rejected');
        END IF;
      END $$;
    `);

    // activity_submissions 表 - 活动提交
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS activity_submissions (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        pictures TEXT,
        remark TEXT,
        status activity_submissions_status_enum DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // 索引
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_submissions(user_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS activity_submissions`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS activity_submissions_status_enum`,
    );
  }
}
