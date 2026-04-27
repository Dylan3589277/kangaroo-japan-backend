import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityTable1746200000000 implements MigrationInterface {
  name = 'CommunityTable1746200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // community 表 - 社区晒单
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS community (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        title VARCHAR(255),
        content TEXT,
        pictures TEXT,
        remark TEXT,
        result TEXT,
        status INT DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // 索引
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_community_status ON community(status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_community_user ON community(user_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS community`);
  }
}
