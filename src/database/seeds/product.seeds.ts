import { DataSource } from 'typeorm';
import {
  Product,
  Platform,
  ProductStatus,
} from '../../products/product.entity';
import { Category } from '../../products/category.entity';

interface ProductSeed {
  titleZh: string;
  titleEn: string;
  titleJa: string;
  descriptionZh: string;
  descriptionEn: string;
  descriptionJa: string;
  priceJpy: number;
  platform: Platform;
  platformProductId: string;
  platformUrl: string;
  categorySlug: string;
  images: string[];
  rating: number;
  reviewCount: number;
  salesCount: number;
  status: ProductStatus;
}

const productSeeds: ProductSeed[] = [
  // 运动户外 - 羽毛球相关
  {
    titleZh: 'YONEX 天斧100ZZ 羽毛球拍 专业级',
    titleEn: 'YONEX Astrox 100ZZ Badminton Racket Pro',
    titleJa: 'YONEX アストロクス100ZZ バドミントンラケット プロ',
    descriptionZh:
      'YONEX日本原装进口，天斧100ZZ专业竞技羽毛球拍，进攻型球拍，拍框材质高弹性碳素+钨，拍身重量4U(约80g)',
    descriptionEn:
      'YONEX Japan imported, Astrox 100ZZ professional competitive badminton racket, attack type, frame material high-elastic carbon + tungsten',
    descriptionJa:
      'YONEX 日本原装輸入、アストロクス100ZZ 專業競技バドミントンラケット、アタックタイプ',
    priceJpy: 25800,
    platform: Platform.RAKUTEN,
    platformProductId: 'rakuten_item_001',
    platformUrl: 'https://item.rakuten.co.jp/example/astrox100zz/',
    categorySlug: 'sports-outdoors',
    images: [
      'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800',
    ],
    rating: 4.8,
    reviewCount: 156,
    salesCount: 89,
    status: ProductStatus.ACTIVE,
  },
  {
    titleZh: 'VICTOR 超级纳米7羽毛球拍 攻防兼备',
    titleEn: 'VICTOR Super Nano 7 Badminton Racket',
    titleJa: 'VICTOR スーパーナノ7 バドミントンラケット',
    descriptionZh:
      'VICTOR经典畅销型号，超级纳米7，攻防兼备型球拍，适合中级以上球友，拍身重量3U/4U可选',
    descriptionEn:
      'VICTOR classic bestseller, Super Nano 7, all-round racket, suitable for intermediate players',
    descriptionJa:
      'VICTOR クラシックベストセラー、スーパーナノ7、オールラウンドラケット',
    priceJpy: 12800,
    platform: Platform.YAHOO,
    platformProductId: 'yahoo_item_001',
    platformUrl: 'https://shopping.yahoo.co.jp/item/example/',
    categorySlug: 'sports-outdoors',
    images: [
      'https://images.unsplash.com/photo-1616627781431-324e9c9f3f10?w=800',
    ],
    rating: 4.6,
    reviewCount: 89,
    salesCount: 45,
    status: ProductStatus.ACTIVE,
  },
  {
    titleZh: 'LI-NING 锋影500 羽毛球拍 速度型',
    titleEn: 'LI-NING Windstorm 500 Badminton Racket Speed Type',
    titleJa: 'LI-NING の風影500 バドミントンラケット スピードタイプ',
    descriptionZh:
      'LI-NING国潮品牌，锋影500速度型球拍，采用铅钛加速系统，适合快攻型打法，拍身重量5U',
    descriptionEn:
      'LI-NING national trend brand, Windstorm 500 speed type racket with lead-titanium acceleration system',
    descriptionJa: 'LI-NING 国潮ブランド、風影500 スピードタイプラケット',
    priceJpy: 9800,
    platform: Platform.RAKUTEN,
    platformProductId: 'rakuten_item_002',
    platformUrl: 'https://item.rakuten.co.jp/example/windstorm500/',
    categorySlug: 'sports-outdoors',
    images: [
      'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800',
    ],
    rating: 4.5,
    reviewCount: 67,
    salesCount: 32,
    status: ProductStatus.ACTIVE,
  },

  // 数码电子 - 耳机/音响
  {
    titleZh: 'Sony WH-1000XM5 无线降噪耳机',
    titleEn: 'Sony WH-1000XM5 Wireless Noise-Canceling Headphones',
    titleJa: 'Sony WH-1000XM5 ワイヤレスノイズキャンセリングヘッドホン',
    descriptionZh:
      'Sony旗舰级无线降噪耳机，搭载V1集成处理器和8颗麦克风，30小时续航，支持LDAC高解析音频传输',
    descriptionEn:
      'Sony flagship wireless noise-canceling headphones with V1 processor and 8 microphones, 30-hour battery life',
    descriptionJa:
      'Sony フラッグシップ ワイヤレスノイズキャンセリングヘッドホン、V1プロセッサー搭載',
    priceJpy: 44800,
    platform: Platform.AMAZON,
    platformProductId: 'amazon_item_001',
    platformUrl: 'https://www.amazon.co.jp/dp/example/',
    categorySlug: 'electronics',
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
    ],
    rating: 4.9,
    reviewCount: 1234,
    salesCount: 567,
    status: ProductStatus.ACTIVE,
  },
  {
    titleZh: 'Apple AirPods Pro 2 USB-C',
    titleEn: 'Apple AirPods Pro 2nd Gen USB-C',
    titleJa: 'Apple AirPods Pro 第2世代 USB-C',
    descriptionZh:
      'Apple AirPods Pro第二代，配备USB-C接口，搭载H2芯片，支持主动降噪和自适应音频，6小时续航',
    descriptionEn:
      'Apple AirPods Pro 2nd generation with USB-C, H2 chip, active noise cancellation, 6-hour battery',
    descriptionJa: 'Apple AirPods Pro 第2世代、USB-C、H2チップ搭載',
    priceJpy: 34800,
    platform: Platform.RAKUTEN,
    platformProductId: 'rakuten_item_003',
    platformUrl: 'https://item.rakuten.co.jp/example/airpodspro2/',
    categorySlug: 'electronics',
    images: [
      'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=800',
    ],
    rating: 4.8,
    reviewCount: 2341,
    salesCount: 1102,
    status: ProductStatus.ACTIVE,
  },
  {
    titleZh: 'Bose QuietComfort Ultra 无线降噪耳机',
    titleEn: 'Bose QuietComfort Ultra Wireless NC Headphones',
    titleJa: 'Bose QuietComfort Ultra ワイヤレスノイズキャンセリング',
    descriptionZh:
      'Bose旗舰降噪耳机，CustomTune智能音场调校，支持沉浸式音频，24小时续航，舒适佩戴设计',
    descriptionEn:
      'Bose flagship noise-canceling with CustomTune technology, immersive audio, 24-hour battery',
    descriptionJa:
      'Bose フラッグシップノイズキャンセリング、CustomTuneテクノロジー搭載',
    priceJpy: 52900,
    platform: Platform.YAHOO,
    platformProductId: 'yahoo_item_002',
    platformUrl: 'https://shopping.yahoo.co.jp/item/example/',
    categorySlug: 'electronics',
    images: ['https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800'],
    rating: 4.7,
    reviewCount: 456,
    salesCount: 198,
    status: ProductStatus.ACTIVE,
  },

  // 服饰箱包 - 背包
  {
    titleZh: 'anello 日本制大口双肩背包',
    titleEn: 'anello Japan Made Large Capacity Backpack',
    titleJa: 'anello 日本製 大口デイパック',
    descriptionZh:
      '日本anello品牌原创双肩背包，大口设计方便取物，主体采用聚酯纤维，尺寸约40x27x18cm，多色可选',
    descriptionEn:
      'Japanese anello brand original backpack, large opening design, polyester body, 40x27x18cm',
    descriptionJa:
      '日本anelloブランド オリジナルデイパック、大口設計、ポリアスター本体',
    priceJpy: 5980,
    platform: Platform.RAKUTEN,
    platformProductId: 'rakuten_item_004',
    platformUrl: 'https://item.rakuten.co.jp/example/anello/',
    categorySlug: 'fashion-bags',
    images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800'],
    rating: 4.6,
    reviewCount: 3456,
    salesCount: 1890,
    status: ProductStatus.ACTIVE,
  },
  {
    titleZh: 'Porter Gregory 日式机能双肩包',
    titleEn: 'Porter Gregory Japanese Functional Backpack',
    titleJa: 'Porter Gregory 日本の機能的バックパック',
    descriptionZh:
      'Porter Gregory日本制机能双肩包，采用Cordura尼龙材质，防水耐磨，分层设计合理，约25L容量',
    descriptionEn:
      'Porter Gregory Japanese functional backpack, Cordura nylon, water-resistant, 25L capacity',
    descriptionJa:
      'Porter Gregory 日本製機能的バックパック、Corduraナイロンメイン',
    priceJpy: 12800,
    platform: Platform.YAHOO,
    platformProductId: 'yahoo_item_003',
    platformUrl: 'https://shopping.yahoo.co.jp/item/example/',
    categorySlug: 'fashion-bags',
    images: [
      'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=800',
    ],
    rating: 4.8,
    reviewCount: 234,
    salesCount: 112,
    status: ProductStatus.ACTIVE,
  },

  // 美妆护肤
  {
    titleZh: 'SK-II 神仙水精华露 230ml',
    titleEn: 'SK-II Facial Treatment Essence 230ml',
    titleJa: 'SK-II スキパワー 精华液 230ml',
    descriptionZh:
      'SK-II经典神仙水，蕴含90%以上PITERA™酵母精华，调理肌肤水油平衡，改善肌肤状态，适合各种肤质',
    descriptionEn:
      'SK-II classic facial treatment essence with 90%+ PITERA, balances skin moisture, improves skin condition',
    descriptionJa: 'SK-II クラシック神仙水、90%以上PITERA酵母エキスを配合',
    priceJpy: 29700,
    platform: Platform.AMAZON,
    platformProductId: 'amazon_item_002',
    platformUrl: 'https://www.amazon.co.jp/dp/example/',
    categorySlug: 'beauty-skincare',
    images: ['https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800'],
    rating: 4.9,
    reviewCount: 5678,
    salesCount: 2345,
    status: ProductStatus.ACTIVE,
  },
  {
    titleZh: 'Shiseido 资生堂红腰子精华 50ml',
    titleEn: 'Shiseido Ultimune Power Infusing Concentrate 50ml',
    titleJa: '資生堂 紅腰子精华 50ml',
    descriptionZh:
      '资生堂红腰子精华，蕴含IM Complex Renewal技术，提升肌肤免疫力，改善细纹松弛，使肌肤焕发活力',
    descriptionEn:
      'Shiseido Ultimune with IM Complex Renewal technology, boosts skin immunity, improves fine lines',
    descriptionJa: '資生堂 紅腰子精华、IM Complex Renewal技術配合',
    priceJpy: 19800,
    platform: Platform.RAKUTEN,
    platformProductId: 'rakuten_item_005',
    platformUrl: 'https://item.rakuten.co.jp/example/ultimune/',
    categorySlug: 'beauty-skincare',
    images: [
      'https://images.unsplash.com/photo-1570194065650-d99fb4b38b15?w=800',
    ],
    rating: 4.7,
    reviewCount: 1234,
    salesCount: 678,
    status: ProductStatus.ACTIVE,
  },

  // 母婴玩具 - 玩具
  {
    titleZh: 'LEGO 星球大战千年隼号 75257',
    titleEn: 'LEGO Star Wars Millennium Falcon 75257',
    titleJa: 'LEGO スター・ウォーズ ミレニアム・ファルコン 75257',
    descriptionZh:
      'LEGO星球大战系列千年隼号飞船拼装玩具，1354颗粒，适合10岁以上，内含5个人仔，还原电影经典场景',
    descriptionEn:
      'LEGO Star Wars Millennium Falcon building set, 1354 pieces, 5 minifigures, for ages 10+',
    descriptionJa:
      'LEGO スター・ウォーズ ミレニアム・ファルコン 1354ピース、5体ミニフィグ',
    priceJpy: 24800,
    platform: Platform.YAHOO,
    platformProductId: 'yahoo_item_004',
    platformUrl: 'https://shopping.yahoo.co.jp/item/example/',
    categorySlug: 'baby-kids',
    images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800'],
    rating: 4.9,
    reviewCount: 789,
    salesCount: 345,
    status: ProductStatus.ACTIVE,
  },
  {
    titleZh: 'Pokemon 宝可梦 皮卡丘伊布电子词典',
    titleEn: 'Pokemon Pikachu & Eevee Electronic Dictionary',
    titleJa: 'ポケモン ピカチュウ・イーブイ 電子辞書',
    descriptionZh:
      '宝可梦主题电子词典，皮卡丘和伊布限定版，内置英语/日语/中文学习功能，适合儿童英语启蒙',
    descriptionEn:
      'Pokemon themed electronic dictionary, Pikachu & Eevee edition, English/Japanese/Chinese learning',
    descriptionJa: 'ポケモン テーマ電子辞書、ピカチュウ・イーブイ 特別版',
    priceJpy: 15800,
    platform: Platform.RAKUTEN,
    platformProductId: 'rakuten_item_006',
    platformUrl: 'https://item.rakuten.co.jp/example/pokemon-dictionary/',
    categorySlug: 'baby-kids',
    images: [
      'https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=800',
    ],
    rating: 4.6,
    reviewCount: 456,
    salesCount: 234,
    status: ProductStatus.ACTIVE,
  },

  // 家居生活
  {
    titleZh: '老虎制药日本进口褪黑素助眠片 30粒',
    titleEn: 'Tiger Pharma Japan Imported Melatonin Sleep Aid 30 tablets',
    titleJa: 'タイガーファーマ 日本製 メラトニン 、睡眠改善 30粒',
    descriptionZh:
      '日本老虎制药出品褪黑素助眠片，每片含3mg褪黑素，帮助调节睡眠周期，改善失眠症状，30粒装',
    descriptionEn:
      'Japanese Tiger Pharma melatonin sleep aid, 3mg per tablet, helps regulate sleep cycle, 30 tablets',
    descriptionJa: '日本Tiger Pharma メラトニン睡眠改善、3mg/錠、30粒入り',
    priceJpy: 1980,
    platform: Platform.RAKUTEN,
    platformProductId: 'rakuten_item_007',
    platformUrl: 'https://item.rakuten.co.jp/example/tiger-melatonin/',
    categorySlug: 'home-living',
    images: ['https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800'],
    rating: 4.5,
    reviewCount: 2345,
    salesCount: 1567,
    status: ProductStatus.ACTIVE,
  },
  {
    titleZh: '虎牌 TIGER 不锈钢保温杯 600ml',
    titleEn: 'TIGER Stainless Steel Thermos Cup 600ml',
    titleJa: 'タイガー 不锈钢ボトル 600ml',
    descriptionZh:
      '日本Tiger牌不锈钢真空保温杯，600ml大容量，一键开合设计，24小时保温，保冷也适用，多色可选',
    descriptionEn:
      'Japanese TIGER stainless steel vacuum thermos, 600ml, one-touch open, 24hr hot/cold retention',
    descriptionJa:
      '日本Tiger 不锈钢ボボトル、600ml、ワンプッシュオープン、24時間保温',
    priceJpy: 4980,
    platform: Platform.YAHOO,
    platformProductId: 'yahoo_item_005',
    platformUrl: 'https://shopping.yahoo.co.jp/item/example/',
    categorySlug: 'home-living',
    images: ['https://images.unsplash.com/photo-1565792468-b671d6a4aa8d?w=800'],
    rating: 4.8,
    reviewCount: 1890,
    salesCount: 923,
    status: ProductStatus.ACTIVE,
  },
];

// 汇率姑且按 0.05 算（JPY -> CNY）
const EXCHANGE_RATE = 0.05;
const USD_RATE = 0.0067;

export async function runProductSeeds(dataSource: DataSource): Promise<void> {
  const productRepo = dataSource.getRepository(Product);
  const categoryRepo = dataSource.getRepository(Category);

  console.log('🌱 Seeding products...');

  // 获取所有分类并建立slug映射
  const categories = await categoryRepo.find();
  const categoryMap = new Map<string, Category>();
  categories.forEach((c) => categoryMap.set(c.slug, c));

  for (const seed of productSeeds) {
    const existing = await productRepo.findOne({
      where: {
        platform: seed.platform,
        platformProductId: seed.platformProductId,
      },
    });

    if (!existing) {
      const category = categoryMap.get(seed.categorySlug);
      const product = productRepo.create({
        titleZh: seed.titleZh,
        titleEn: seed.titleEn,
        titleJa: seed.titleJa,
        descriptionZh: seed.descriptionZh,
        descriptionEn: seed.descriptionEn,
        descriptionJa: seed.descriptionJa,
        priceJpy: seed.priceJpy,
        priceCny: Math.round(seed.priceJpy * EXCHANGE_RATE * 100) / 100,
        priceUsd: Math.round(seed.priceJpy * USD_RATE * 100) / 100,
        exchangeRateUsed: EXCHANGE_RATE,
        currency: 'JPY',
        platform: seed.platform,
        platformProductId: seed.platformProductId,
        platformUrl: seed.platformUrl,
        categoryId: category?.id,
        images: seed.images,
        imagesCount: seed.images.length,
        rating: seed.rating,
        reviewCount: seed.reviewCount,
        salesCount: seed.salesCount,
        status: seed.status,
      });

      await productRepo.save(product);
      console.log(`  ✅ Created product: ${seed.titleZh}`);
    } else {
      console.log(`  ⏭️  Product already exists: ${seed.titleZh}`);
    }
  }

  console.log('🌱 Product seeding completed!');
}
