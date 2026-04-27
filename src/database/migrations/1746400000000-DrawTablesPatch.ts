import { MigrationInterface, QueryRunner } from 'typeorm';

export class DrawTablesPatch1746400000000 implements MigrationInterface {
  name = 'DrawTablesPatch1746400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 新增 daily_limit 字段（兼容已有表）
    await queryRunner.query(`
      ALTER TABLE draw_activitys
        ADD COLUMN IF NOT EXISTS daily_limit INT DEFAULT 0;
    `);
    // 给 draw_prizes 加 activity_id 索引（兼容已有表）
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_draw_prizes_activity
        ON draw_prizes(activity_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_draw_prizes_activity`);
    await queryRunner.query(
      `ALTER TABLE draw_activitys DROP COLUMN IF EXISTS daily_limit`,
    );
  }
}
