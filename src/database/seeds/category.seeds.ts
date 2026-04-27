import { DataSource } from 'typeorm';
import { Category } from '../../products/category.entity';

export const categorySeeds: Partial<Category>[] = [
  {
    nameZh: '运动户外',
    nameEn: 'Sports & Outdoors',
    nameJa: 'スポーツ・アウトドア',
    nameKo: '스포츠·아웃도어',
    nameTh: 'กีฬาและกิจกรรมกลางแจ้ง',
    nameId: 'Olahraga & Luar Ruangan',
    nameVi: 'Thể thao & Ngoài trời',
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
    nameKo: '전자제품',
    nameTh: 'อิเล็กทรอนิกส์',
    nameId: 'Elektronik',
    nameVi: 'Điện tử',
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
    nameKo: '패션·가방',
    nameTh: 'แฟชั่นและกระเป๋า',
    nameId: 'Fashion & Tas',
    nameVi: 'Thời trang & Túi xách',
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
    nameKo: '뷰티·스킨케어',
    nameTh: 'ความงามและการดูแลผิว',
    nameId: 'Kecantikan & Perawatan Kulit',
    nameVi: 'Làm đẹp & Chăm sóc da',
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
    nameKo: '유아·아동용품',
    nameTh: 'เด็กและของเล่น',
    nameId: 'Bayi & Anak-anak',
    nameVi: 'Trẻ em & Đồ chơi',
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
    nameKo: '홈·리빙',
    nameTh: 'บ้านและที่อยู่อาศัย',
    nameId: 'Rumah & Kehidupan',
    nameVi: 'Nhà cửa & Đời sống',
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
