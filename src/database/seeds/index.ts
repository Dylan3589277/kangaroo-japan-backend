import { DataSource } from 'typeorm';
import { runCategorySeeds } from './category.seeds';
import { runProductSeeds } from './product.seeds';

export async function runAllSeeds(dataSource: DataSource): Promise<void> {
  console.log('🚀 Starting database seeding...');
  console.log('='.repeat(50));

  await runCategorySeeds(dataSource);
  console.log('-'.repeat(50));
  await runProductSeeds(dataSource);

  console.log('='.repeat(50));
  console.log('✅ All seeds completed!');
}

// 如果直接运行此文件
if (require.main === module) {
  // 支持 DATABASE_URL 或分开的 DB_* 环境变量
  const dbUrl = process.env.DATABASE_URL;
  let config: any = {
    type: 'postgres',
    entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
    synchronize: false,
  };
  
  if (dbUrl) {
    // 检测是否需要 SSL
    const needsSsl = dbUrl.includes('sslmode=') || dbUrl.includes('ssl=');
    const sslMode = dbUrl.match(/sslmode=([^&\s]+)/)?.[1] || 'prefer';
    
    // Parse postgresql://user:***@host:port/database (with optional query params)
    const match = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
    if (match) {
      config = {
        ...config,
        username: match[1],
        password: match[2],
        host: match[3],
        port: parseInt(match[4], 10),
        database: match[5],
      };
      // Prisma Data Platform requires SSL
      if (needsSsl) {
        config.ssl = sslMode === 'require' || sslMode === 'verify-full' 
          ? { rejectUnauthorized: false }
          : true;
        console.log(`🔒 SSL mode: ${sslMode}`);
      }
    } else {
      // 如果 regex 不匹配，直接使用 URL
      config.url = dbUrl;
    }
  } else {
    config = {
      ...config,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'kangaroo_japan',
    };
  }

  const dataSource = new DataSource(config);

  dataSource
    .initialize()
    .then(async () => {
      try {
        await runAllSeeds(dataSource);
      } finally {
        await dataSource.destroy();
      }
    })
    .catch(console.error);
}
