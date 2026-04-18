import { DataSource } from 'typeorm';
import { Category } from '../../products/category.entity';

export const categorySeeds: Partial<Category>[] = [
  {
    nameZh: '运动户外',
    nameEn: 'Sports & Outdoors',
    nameJa: 'スポーツ・アウトドア',
    slug: 'sports-outdoors',
    level: 0,
    sortOrder: 1,
    isActive: true,
    path: [],
  },
  {
    nameZh: '数码电子',
    nameEn: 'Electronics',
    nameJa: '家電・デジタル',
    slug: 'electronics',
    level: 0,
    sortOrder: 2,
    isActive: true,
    path: [],
  },
  {
    nameZh: '服饰箱包',
    nameEn: 'Fashion & Bags',
    nameJa: 'ファッション・バッグ',
    slug: 'fashion-bags',
    level: 0,
    sortOrder: 3,
    isActive: true,
    path: [],
  },
  {
    nameZh: '美妆护肤',
    nameEn: 'Beauty & Skincare',
    nameJa: 'ビューティー・スキンケア',
    slug: 'beauty-skincare',
    level: 0,
    sortOrder: 4,
    isActive: true,
    path: [],
  },
  {
    nameZh: '母婴玩具',
    nameEn: 'Baby & Kids',
    nameJa: 'ベビー・子供用品',
    slug: 'baby-kids',
    level: 0,
    sortOrder: 5,
    isActive: true,
    path: [],
  },
  {
    nameZh: '家居生活',
    nameEn: 'Home & Living',
    nameJa: 'ホーム・リビング',
    slug: 'home-living',
    level: 0,
    sortOrder: 6,
    isActive: true,
    path: [],
  },
];

export async function runCategorySeeds(dataSource: DataSource): Promise<void> {
  const categoryRepo = dataSource.getRepository(Category);

  console.log('🌱 Seeding categories...');

  for (const cat of categorySeeds) {
    const existing = await categoryRepo.findOne({ where: { slug: cat.slug } });
    if (!existing) {
      await categoryRepo.save(categoryRepo.create(cat));
      console.log(`  ✅ Created category: ${cat.nameZh}`);
    } else {
      console.log(`  ⏭️  Category already exists: ${cat.nameZh}`);
    }
  }

  console.log('🌱 Category seeding completed!');
}
