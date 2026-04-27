import { MigrationInterface, QueryRunner } from 'typeorm';

export class DrawTables1746100000000 implements MigrationInterface {
  name = 'DrawTables1746100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // draw_activitys 表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS draw_activitys (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(128) DEFAULT '',
        price INT DEFAULT 0,
        content TEXT,
        run_type VARCHAR(16) DEFAULT 'year',
        rundate VARCHAR(64) DEFAULT '',
        status INT DEFAULT 1,
        daily_limit INT DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // draw_prizes 表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS draw_prizes (
        id VARCHAR(36) PRIMARY KEY,
        activity_id VARCHAR(255),
        type VARCHAR(32) DEFAULT 'none',
        name VARCHAR(128) DEFAULT '',
        cover TEXT,
        prize VARCHAR(64) DEFAULT '0',
        rate INT DEFAULT 0,
        number INT DEFAULT 0,
        left_number INT DEFAULT 0,
        sales INT DEFAULT 0,
        is_deleted INT DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // draw_logs 表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS draw_logs (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        activity_id VARCHAR(255),
        activity_name VARCHAR(128) DEFAULT '',
        price INT DEFAULT 0,
        prize VARCHAR(64) DEFAULT '0',
        type VARCHAR(32) DEFAULT 'none',
        name VARCHAR(128) DEFAULT '',
        cover TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // 索引
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_draw_logs_user ON draw_logs(user_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_draw_prizes_activity ON draw_prizes(activity_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS draw_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS draw_prizes`);
    await queryRunner.query(`DROP TABLE IF EXISTS draw_activitys`);
  }
}
