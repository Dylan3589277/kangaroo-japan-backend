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
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'kangaroo_japan',
    entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
    synchronize: false,
  });

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
