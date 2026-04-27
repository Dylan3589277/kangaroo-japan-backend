/**
 * 数据库初始化和种子数据填充脚本
 * 用法: npx ts-node src/database/init.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbUrl = process.env.DATABASE_URL;

async function initialize() {
  console.log('='.repeat(60));
  console.log('🚀 袋鼠君数据库初始化脚本');
  console.log('='.repeat(60));
  console.log(`使用数据库: ${dbUrl ? dbUrl.replace(/:[^:@]+@/, ':***@') : '未设置'}`);
  console.log('');

  // 解析 URL 以匹配 TypeORM 配置
  let config: any = {
    type: 'postgres',
    synchronize: false, // 我们用 migration run 来确保
    migrationsRun: true,
    logging: true,
    entities: [path.join(__dirname, '/../../dist/**/*.entity{.ts,.js}')],
    migrations: [path.join(__dirname, '/../../dist/database/migrations/*{.ts,.js}')],
    migrationsTableName: 'typeorm_migrations',
  };

  if (dbUrl) {
    const match = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
    if (match) {
      config = {
        ...config,
        host: match[3],
        port: parseInt(match[4], 10),
        username: match[1],
        password: match[2],
        database: match[5],
      };
      console.log(`📊 数据库: ${match[5]} @ ${match[3]}:${match[4]}`);
      console.log(`👤 用户: ${match[1]}`);
      console.log('');
    } else {
      // TypeORM 也支持直接传 url
      console.log('使用 url 直连...');
      config.url = dbUrl;
    }
  }

  const dataSource = new DataSource(config);

  try {
    console.log('🔌 连接数据库...');
    await dataSource.initialize();
    console.log('✅ 数据库连接成功!');
    console.log('');

    // 运行迁移
    console.log('📋 检查并运行数据库迁移...');
    const migrations = await dataSource.runMigrations({ transaction: 'all' });
    if (migrations.length > 0) {
      console.log(`✅ 已运行 ${migrations.length} 个迁移:`);
      for (const m of migrations) {
        console.log(`   - ${m.name}`);
      }
    } else {
      console.log('✅ 没有待运行的迁移 (数据库已是最新)');
    }
    console.log('');

    console.log('='.repeat(60));
    console.log('✅ 数据库初始化完成!');
    console.log('='.repeat(60));

    // 现在运行种子数据
    console.log('');
    console.log('🌱 开始填充种子数据...');
    const { runAllSeeds } = require('../../dist/database/seeds/index');
    await runAllSeeds(dataSource);

    await dataSource.destroy();
    console.log('✅ 所有操作完成!');
    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

initialize();
