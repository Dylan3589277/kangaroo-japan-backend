import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class YahooAuctionTables1746000000000 implements MigrationInterface {
  name = 'YahooAuctionTables1746000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // yahoo_goods 表新增字段（如果已有表）
    try {
      await queryRunner.query(`
        ALTER TABLE yahoo_goods
        ADD COLUMN IF NOT EXISTS auction_start_at timestamp NULL,
        ADD COLUMN IF NOT EXISTS auction_end_at timestamp NULL,
        ADD COLUMN IF NOT EXISTS current_price decimal(12,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS buyout_price decimal(12,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS sync_status varchar(32) DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS last_error text NULL,
        ADD COLUMN IF NOT EXISTS version int DEFAULT 1;
      `);
    } catch {
      // 表可能不存在，回退创建
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS yahoo_goods (
          id VARCHAR(36) PRIMARY KEY,
          goods_no VARCHAR(64) NOT NULL UNIQUE,
          goods_name TEXT NOT NULL,
          price DECIMAL(12,2) DEFAULT 0,
          bid_price DECIMAL(12,2) DEFAULT 0,
          fastprice DECIMAL(12,2) DEFAULT 0,
          current_price DECIMAL(12,2) DEFAULT 0,
          buyout_price DECIMAL(12,2) DEFAULT 0,
          cover TEXT,
          images JSON DEFAULT '[]',
          seller VARCHAR(255),
          seller_id VARCHAR(255),
          seller_address VARCHAR(255),
          rate_num VARCHAR(64),
          rate_percent VARCHAR(64),
          bid_num INT DEFAULT 0,
          content TEXT,
          description TEXT,
          extras JSON DEFAULT '[]',
          url TEXT,
          end_time VARCHAR(128),
          left_timestamp INT DEFAULT 0,
          auction_start_at TIMESTAMP NULL,
          auction_end_at TIMESTAMP NULL,
          price_title VARCHAR(32),
          category_id INT DEFAULT 0,
          status VARCHAR(32) DEFAULT 'active',
          sync_status VARCHAR(32) DEFAULT 'pending',
          last_error TEXT,
          version INT DEFAULT 1,
          raw_data JSON,
          last_synced_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        );
      `);

      // 创建索引
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_yahoo_goods_no ON yahoo_goods(goods_no)`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_yahoo_status ON yahoo_goods(status)`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_yahoo_sync_status ON yahoo_goods(sync_status)`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_yahoo_category ON yahoo_goods(category_id)`);
    }

    // yahoo_bids 表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS yahoo_bids (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        goods_no VARCHAR(64) NOT NULL,
        price DECIMAL(12,2) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'bidding',
        is_high BOOLEAN DEFAULT false,
        bid_no VARCHAR(128) NULL,
        deposit_hold_amount DECIMAL(12,2) DEFAULT 0,
        external_bid_id VARCHAR(255) NULL,
        failure_reason TEXT NULL,
        placed_at TIMESTAMP NULL,
        settled_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // yahoo_bids 索引
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_yahoo_bids_user ON yahoo_bids(user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_yahoo_bids_goods ON yahoo_bids(goods_no)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_yahoo_bids_status ON yahoo_bids(status)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 不删除表，只移除新增的列
    await queryRunner.query(`ALTER TABLE yahoo_goods DROP COLUMN IF EXISTS auction_start_at`);
    await queryRunner.query(`ALTER TABLE yahoo_goods DROP COLUMN IF EXISTS auction_end_at`);
    await queryRunner.query(`ALTER TABLE yahoo_goods DROP COLUMN IF EXISTS current_price`);
    await queryRunner.query(`ALTER TABLE yahoo_goods DROP COLUMN IF EXISTS buyout_price`);
    await queryRunner.query(`ALTER TABLE yahoo_goods DROP COLUMN IF EXISTS sync_status`);
    await queryRunner.query(`ALTER TABLE yahoo_goods DROP COLUMN IF EXISTS last_error`);
    await queryRunner.query(`ALTER TABLE yahoo_goods DROP COLUMN IF EXISTS version`);
  }
}
