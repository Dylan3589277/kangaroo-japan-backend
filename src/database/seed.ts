/**
 * 袋鼠君日本代购 - 种子数据
 * 包含分类和示例商品数据
 *
 * 使用方式:
 * import { runSeed } from './seed';
 * await runSeed(dataSource);
 */

import { DataSource } from 'typeorm';
import { Category } from '../products/category.entity';
import { Product, Platform, ProductStatus } from '../products/product.entity';

// 日元兑人民币汇率 (示例，实际使用时从 API 获取)
const EXCHANGE_RATE_JPY_TO_CNY = 0.046;
const EXCHANGE_RATE_JPY_TO_USD = 0.0067;

interface SeedCategory {
  nameZh: string;
  nameEn: string;
  nameJa: string;
  slug: string;
  parentId?: string;
  level: number;
  sortOrder: number;
}

interface SeedProduct {
  platform: Platform;
  platformProductId: string;
  titleZh: string;
  titleEn: string;
  titleJa: string;
  descriptionZh: string;
  descriptionEn: string;
  descriptionJa: string;
  priceJpy: number;
  currency: string;
  images: string[];
  categoryId: string;
  rating: number;
  reviewCount: number;
  salesCount: number;
  status: ProductStatus;
  sellerName: string;
}

// ==================== 分类数据 ====================
const categories: SeedCategory[] = [
  // Level 0 - 顶级分类
  {
    nameZh: '电子产品',
    nameEn: 'Electronics',
    nameJa: '家电・electronics',
    slug: 'electronics',
    level: 0,
    sortOrder: 1,
  },
  {
    nameZh: '时尚服饰',
    nameEn: 'Fashion',
    nameJa: 'ファッション',
    slug: 'fashion',
    level: 0,
    sortOrder: 2,
  },
  {
    nameZh: '户外运动',
    nameEn: 'Sports & Outdoors',
    nameJa: 'スポーツ・Outdoor',
    slug: 'sports-outdoors',
    level: 0,
    sortOrder: 3,
  },
  {
    nameZh: '书籍影音',
    nameEn: 'Books & Media',
    nameJa: '本・Media',
    slug: 'books-media',
    level: 0,
    sortOrder: 4,
  },
  {
    nameZh: '家居生活',
    nameEn: 'Home & Living',
    nameJa: 'ホーム・的生活',
    slug: 'home-living',
    level: 0,
    sortOrder: 5,
  },
];

// 存储创建的分类 ID 映射
const categoryIdMap = new Map<string, string>();

// ==================== 商品数据 ====================
const products: SeedProduct[] = [
  // ========== 电子产品 ==========
  {
    platform: Platform.RAKUTEN,
    platformProductId: 'rakuten:electronics:001',
    titleZh: '索尼 WH-1000XM5 无线降噪耳机',
    titleEn: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
    titleJa: 'Sony WH-1000XM5 ワイヤレスノイズキャンセリングヘッドフォン',
    descriptionZh:
      '业界顶级降噪效果，30小时续航，高解析度音频支持，佩戴舒适度大幅提升。',
    descriptionEn:
      'Industry-leading noise cancellation, 30-hour battery life, hi-res audio support, improved comfort.',
    descriptionJa:
      '業界トップのノイズキャンセリング、30時間バッテリー駆動、ハイレゾオーディオ対応、装着感が大幅に向上。',
    priceJpy: 39800,
    currency: 'JPY',
    images: [
      'https://images-na.ssl-images-amazon.com/images/I/61QjQ3UqMOS._AC_SL1500_.jpg',
    ],
    categoryId: '', // 动态设置
    rating: 4.7,
    reviewCount: 2847,
    salesCount: 1523,
    status: ProductStatus.ACTIVE,
    sellerName: 'Sony Japan',
  },
  {
    platform: Platform.YAHOO,
    platformProductId: 'yahoo:electronics:002',
    titleZh: 'Switch游戏机 OLED款 日版',
    titleEn: 'Nintendo Switch OLED Model - Japan Version',
    titleJa: 'Nintendo Switch 有機ELモデル Joy-Con Joy-Con',
    descriptionZh:
      '7英寸OLED屏幕，桌面模式更清晰，内置64GB存储，约4000款游戏兼容。',
    descriptionEn:
      '7-inch OLED screen, clearer in tabletop mode, 64GB storage, compatible with ~4000 games.',
    descriptionJa:
      '7インチ有機ELスクリーン、テーブルトップモードでより鮮明、64GBストレージ、約4000本のゲームに対応。',
    priceJpy: 37980,
    currency: 'JPY',
    images: [
      'https://images-na.ssl-images-amazon.com/images/I/61QLm3Ws8YS._AC_SL1500_.jpg',
    ],
    categoryId: '',
    rating: 4.8,
    reviewCount: 5621,
    salesCount: 3201,
    status: ProductStatus.ACTIVE,
    sellerName: 'Nintendo',
  },
  {
    platform: Platform.AMAZON,
    platformProductId: 'amazon:electronics:003',
    titleZh: '戴森 V15 Detect 无绳吸尘器',
    titleEn: 'Dyson V15 Detect Cordless Vacuum',
    titleJa: 'Dyson V15 Detect コードレスクリーナー',
    descriptionZh: '激光探测微尘，LCD屏幕实时显示，60分钟续航，HEPA过滤系统。',
    descriptionEn:
      'Laser reveals microscopic dust, LCD screen shows real-time data, 60-min runtime, HEPA filtration.',
    descriptionJa:
      'レーザーで微細なチリを検出、LCDスクリーンにリアルタイム表示、60分バッテリー駆動、HEPAフィルター搭載。',
    priceJpy: 79800,
    currency: 'JPY',
    images: [
      'https://images-na.ssl-images-amazon.com/images/I/71NbXfRudOL._AC_SL1500_.jpg',
    ],
    categoryId: '',
    rating: 4.6,
    reviewCount: 1243,
    salesCount: 587,
    status: ProductStatus.ACTIVE,
    sellerName: 'Dyson',
  },
  {
    platform: Platform.MERCARI,
    platformProductId: 'mercari:electronics:004',
    titleZh: 'iPad Pro 12.9英寸 M2芯片 256GB WiFi',
    titleEn: 'iPad Pro 12.9-inch M2 Chip 256GB WiFi',
    titleJa: 'iPad Pro 12.9インチ M2チップ 256GB WiFi',
    descriptionZh:
      'M2芯片性能强劲，12.9英寸Liquid Retina XDR显示屏，支持Apple Pencil悬停功能。',
    descriptionEn:
      'Powerful M2 chip, 12.9-inch Liquid Retina XDR display, Apple Pencil hover support.',
    descriptionJa:
      '強力なM2チップ、12.9インチLiquid Retina XDRディスプレイ、Apple Pencilホバーサポート対応。',
    priceJpy: 128800,
    currency: 'JPY',
    images: [
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/ipad-pro-finish-select-202212-12-9inch-spacegray_WiFi?wid=940&hei=1112&fmt=png-alpha',
    ],
    categoryId: '',
    rating: 4.9,
    reviewCount: 892,
    salesCount: 234,
    status: ProductStatus.ACTIVE,
    sellerName: 'Apple Store JP',
  },
  {
    platform: Platform.RAKUTEN,
    platformProductId: 'rakuten:electronics:005',
    titleZh: '富士 X-T5 微单相机 银色',
    titleEn: 'Fujifilm X-T5 Mirrorless Camera - Silver',
    titleJa: 'Fujifilm X-T5 ミラーレスカメラ シルバー',
    descriptionZh:
      '4020万像素X-Trans CMOS 5 HR传感器，7档五轴防抖，18种胶片模拟模式。',
    descriptionEn:
      '40.2MP X-Trans CMOS 5 HR sensor, 7-stop IBIS, 19 Film Simulations.',
    descriptionJa:
      '4020万像素X-Trans CMOS 5 HRセンサー、7段ボディ内手ブレ補正、19種類のフィルムシミュレーション。',
    priceJpy: 219800,
    currency: 'JPY',
    images: [
      'https://image.rakuten.co.jp/camera-no-minegishi/cabinet/x-t5_1.jpg',
    ],
    categoryId: '',
    rating: 4.8,
    reviewCount: 156,
    salesCount: 89,
    status: ProductStatus.ACTIVE,
    sellerName: 'Fujifilm公式店',
  },

  // ========== 时尚服饰 ==========
  {
    platform: Platform.RAKUTEN,
    platformProductId: 'rakuten:fashion:001',
    titleZh: '优衣库 U系列 高级轻型羽绒服',
    titleEn: 'UNIQLO U Series Light Down Jacket',
    titleJa: 'ユニクロ Uシリーズ ウルトラライトダウン',
    descriptionZh: '超轻量设计，可收纳设计，保暖性极佳，简约时尚款式。',
    descriptionEn:
      'Ultra-lightweight, packable design, excellent warmth, minimalist style.',
    descriptionJa:
      '超軽量設計、収納可能設計、優れた保温性、ミニマリストなデザイン。',
    priceJpy: 5990,
    currency: 'JPY',
    images: ['https://image.rakuten.co.jp/uniqlo/cabinet/ood/i/b1089-01.jpg'],
    categoryId: '',
    rating: 4.5,
    reviewCount: 8932,
    salesCount: 5621,
    status: ProductStatus.ACTIVE,
    sellerName: 'UNIQLO公式ストア',
  },
  {
    platform: Platform.YAHOO,
    platformProductId: 'yahoo:fashion:002',
    titleZh: '北面 1996 Retro Nuptse 羽绒服',
    titleEn: 'The North Face 1996 Retro Nuptse Down Jacket',
    titleJa: 'ザ・ノース・フェイス 1996 レトロ Nunptse ダウン',
    descriptionZh: '经典复古设计，700蓬松度鹅绒填充，防泼水面料。',
    descriptionEn:
      'Classic retro design, 700-fill goose down, water-repellent fabric.',
    descriptionJa: 'クラシックなレトロデザイン、700フィル鹅绒ダウン撥水面料。',
    priceJpy: 24990,
    currency: 'JPY',
    images: [
      'https://shop.rakuten.co.jp/gold/northface/products/img/goods/NF00A8F3G_main.jpg',
    ],
    categoryId: '',
    rating: 4.7,
    reviewCount: 2341,
    salesCount: 1203,
    status: ProductStatus.ACTIVE,
    sellerName: 'north face公式旗舰店',
  },
  {
    platform: Platform.MERCARI,
    platformProductId: 'mercari:fashion:003',
    titleZh: 'New Balance 2002R 复古运动鞋',
    titleEn: 'New Balance 2002R Retro Sneakers',
    titleJa: 'New Balance 2002R レトロスニーカー',
    descriptionZh: 'ABZORB缓震技术，麂皮与网眼材质拼接，复古百搭款式。',
    descriptionEn:
      'ABZORB cushioning technology, suede and mesh upper, versatile retro style.',
    descriptionJa:
      'ABZORB、クッション技術、スエードとメッシュのアッパー、ベーシックなレトロスタイル。',
    priceJpy: 18900,
    currency: 'JPY',
    images: [
      'https://images-na.ssl-images-amazon.com/images/I/81vJq1q3waL._AC_SL1500_.jpg',
    ],
    categoryId: '',
    rating: 4.6,
    reviewCount: 1823,
    salesCount: 934,
    status: ProductStatus.ACTIVE,
    sellerName: 'New Balance Japan',
  },
  {
    platform: Platform.AMAZON,
    platformProductId: 'amazon:fashion:004',
    titleZh: '巴宝莉 TB标识图案真丝围巾',
    titleEn: 'Burberry TB Logo Silk Scarf',
    titleJa: 'バーバリー TBロゴ シルク围巾',
    descriptionZh: '100%真丝材质，品牌标志性TB图案，英伦风格，适合送礼。',
    descriptionEn:
      '100% silk, iconic TB pattern, British style, perfect for gifting.',
    descriptionJa:
      'シルク100%、アイコン的なTBパターン、イギリススタイル、プレゼントに最適。',
    priceJpy: 38500,
    currency: 'JPY',
    images: [
      'https://images-na.ssl-images-amazon.com/images/I/71f5Z5gKIjL._AC_SL1500_.jpg',
    ],
    categoryId: '',
    rating: 4.8,
    reviewCount: 456,
    salesCount: 189,
    status: ProductStatus.ACTIVE,
    sellerName: 'Burberry',
  },

  // ========== 户外运动 ==========
  {
    platform: Platform.RAKUTEN,
    platformProductId: 'rakuten:sports:001',
    titleZh: '始祖鸟 Beta LT 硬壳冲锋衣',
    titleEn: "Arc'teryx Beta LT Hardshell Jacket",
    titleJa: 'アークテリクス Beta LT ハードシェル',
    descriptionZh: 'Gore-Tex Pro防水透气面料，轻量设计，专业户外防护。',
    descriptionEn:
      'Gore-Tex Pro waterproof breathable fabric, lightweight design, professional outdoor protection.',
    descriptionJa:
      'Gore-Tex Pro防水透湿面料、軽量設計、プロフェッショナルなOutdoor-protection。',
    priceJpy: 68000,
    currency: 'JPY',
    images: [
      'https://images-na.ssl-images-amazon.com/images/I/81vJq1q3waL._AC_SL1500_.jpg',
    ],
    categoryId: '',
    rating: 4.9,
    reviewCount: 678,
    salesCount: 312,
    status: ProductStatus.ACTIVE,
    sellerName: "ARC'TERYX",
  },
  {
    platform: Platform.YAHOO,
    platformProductId: 'yahoo:sports:002',
    titleZh: '索尼 PS5 游戏主机 超高速SSD版',
    titleEn: 'PlayStation 5 SSD Edition',
    titleJa: 'PlayStation 5 SSDエディション',
    descriptionZh: '825GB SSD，超高速加载，4K游戏，HDR技术，Tempest 3D音效。',
    descriptionEn:
      '825GB SSD, ultra-fast loading, 4K gaming, HDR, Tempest 3D AudioTech.',
    descriptionJa:
      '825GB SSD、超高速ロード、4Kゲーム、HDR技術、Tempest 3Dオーディオテク。',
    priceJpy: 54980,
    currency: 'JPY',
    images: [
      'https://images-na.ssl-images-amazon.com/images/I/71vqQUNMUBL._AC_SL1500_.jpg',
    ],
    categoryId: '',
    rating: 4.9,
    reviewCount: 12453,
    salesCount: 8921,
    status: ProductStatus.ACTIVE,
    sellerName: 'Sony Interactive Entertainment',
  },
  {
    platform: Platform.MERCARI,
    platformProductId: 'mercari:sports:003',
    titleZh: '雅思顿 山地自行车 XTC SLR 27.5',
    titleEn: 'Giant Mountain Bike XTC SLR 27.5',
    titleJa: 'ジャイアント マウンテンバイク XTC SLR 27.5',
    descriptionZh: '轻量化铝架，禧玛诺Deore 20速变速，线控锁死前叉。',
    descriptionEn:
      'Lightweight aluminum frame, Shimano Deore 20-speed, remote lockout fork.',
    descriptionJa:
      '軽量アルミニウムフレーム、Shimano Deore 20段変速、リモートロックアウトフォーク。',
    priceJpy: 79800,
    currency: 'JPY',
    images: [
      'https://images-na.ssl-images-amazon.com/images/I/71vqQUNMUBL._AC_SL1500_.jpg',
    ],
    categoryId: '',
    rating: 4.5,
    reviewCount: 234,
    salesCount: 87,
    status: ProductStatus.ACTIVE,
    sellerName: 'Giant Store Tokyo',
  },

  // ========== 书籍影音 ==========
  {
    platform: Platform.RAKUTEN,
    platformProductId: 'rakuten:books:001',
    titleZh: '咒术回战 漫画单行本 1-27卷全套',
    titleEn: 'Jujutsu Kaisen Manga Box Set Vol.1-27',
    titleJa: '呪術廻戦 漫画全27巻セット',
    descriptionZh: '芥见下々人气漫画全套27卷，含特制书盒，少年jump热门作品。',
    descriptionEn:
      'Complete 27-volume manga box set by Gege Akutami, Jujutsu Kaisen.',
    descriptionJa:
      '芥見下々人気漫画全27巻、専用ボックス，少年ジャンプ人気作品。',
    priceJpy: 26730,
    currency: 'JPY',
    images: [
      'https://images-na.ssl-images-amazon.com/images/I/81vJq1q3waL._AC_SL1500_.jpg',
    ],
    categoryId: '',
    rating: 4.9,
    reviewCount: 3421,
    salesCount: 1523,
    status: ProductStatus.ACTIVE,
    sellerName: '東亜書店',
  },
  {
    platform: Platform.YAHOO,
    platformProductId: 'yahoo:books:002',
    titleZh: '索尼 PS5 《最终幻想16》游戏盘',
    titleEn: 'Final Fantasy XVI for PlayStation 5',
    titleJa: 'ファイナルファンタジーXVI PlayStation 5版',
    descriptionZh: 'FF16 PS5独占发行，野村哲也导演，召唤兽战斗系统，画面惊艳。',
    descriptionEn:
      'FF16 PS5 exclusive, directed by Tetsuya Nomura, Eikon battles, stunning visuals.',
    descriptionJa:
      'FF16 PS5独占発売、野村哲也ディレクター、召喚獣戦闘システム、素晴らしいビジュアル。',
    priceJpy: 8690,
    currency: 'JPY',
    images: [
      'https://images-na.ssl-images-amazon.com/images/I/81vJq1q3waL._AC_SL1500_.jpg',
    ],
    categoryId: '',
    rating: 4.7,
    reviewCount: 1567,
    salesCount: 892,
    status: ProductStatus.ACTIVE,
    sellerName: 'Square Enix',
  },
  {
    platform: Platform.AMAZON,
    platformProductId: 'amazon:books:003',
    titleZh: '铁血战士：狩猎开始 4K UHD蓝光碟',
    titleEn: 'Predator: Hunting Grounds 4K UHD Blu-ray',
    titleJa: 'プレデター：ハunting开始 4K UHDブルーレイ',
    descriptionZh: '4K超高清画质+蓝光双碟版，HDR10+支持，完整花絮内容。',
    descriptionEn:
      '4K Ultra HD + Blu-ray combo, HDR10+, complete bonus features.',
    descriptionJa:
      '4K Ultra HD + Blu-rayコンボ、HDR10+対応、完整なボーナス Features。',
    priceJpy: 3980,
    currency: 'JPY',
    images: [
      'https://images-na.ssl-images-amazon.com/images/I/81vJq1q3waL._AC_SL1500_.jpg',
    ],
    categoryId: '',
    rating: 4.5,
    reviewCount: 234,
    salesCount: 156,
    status: ProductStatus.ACTIVE,
    sellerName: 'Sony Pictures',
  },

  // ========== 家居生活 ==========
  {
    platform: Platform.RAKUTEN,
    platformProductId: 'rakuten:home:001',
    titleZh: '虎牌 TIGER 电饭煲炊饭王子 JNP系列',
    titleEn: 'TIGER Tiger Rice Cooker JNP Series',
    titleJa: 'タイガー TIGER 炊飯王子 JNPシリーズ',
    descriptionZh: '多功能炊饭模式，保温24小时，不粘锅内胆，日本制。',
    descriptionEn:
      'Multiple cooking modes, 24-hour keep warm, non-stick inner pot, Made in Japan.',
    descriptionJa:
      '多功能炊飯モード、24時間保温、焦げ付かない内釜、Made in Japan。',
    priceJpy: 19800,
    currency: 'JPY',
    images: ['https://image.rakuten.co.jp/tiger JP/cabinet/cg/ke1021.jpg'],
    categoryId: '',
    rating: 4.7,
    reviewCount: 4521,
    salesCount: 2134,
    status: ProductStatus.ACTIVE,
    sellerName: 'Tiger魔法瓶公式',
  },
  {
    platform: Platform.YAHOO,
    platformProductId: 'yahoo:home:002',
    titleZh: '象印 ZOJIRUSHI 压力IH电饭煲',
    titleEn: 'ZOJIRUSHI Pressure IH Rice Cooker',
    titleJa: '象印 圧力IH炊飯器',
    descriptionZh: '压力IH加热技术，糙米/发芽米模式，不锈钢本体，大容量5.5合。',
    descriptionEn:
      'Pressure IH heating, brown/germinated rice modes, stainless body, 5.5-cup capacity.',
    descriptionJa:
      '圧力IH加熱、糙米/発芽米モード、ステンレスボディ、5.5合容量。',
    priceJpy: 35000,
    currency: 'JPY',
    images: [
      'https://images-na.ssl-images-amazon.com/images/I/71vqQUNMUBL._AC_SL1500_.jpg',
    ],
    categoryId: '',
    rating: 4.8,
    reviewCount: 3214,
    salesCount: 1567,
    status: ProductStatus.ACTIVE,
    sellerName: 'ZOJIRUSHI官方旗舰店',
  },
  {
    platform: Platform.MERCARI,
    platformProductId: 'mercari:home:003',
    titleZh: '任天堂Switch OLED 桌面收纳底座套装',
    titleEn: 'Nintendo Switch OLED Dock & Storage Set',
    titleJa: 'Nintendo Switch 有機ELモデル Dock & Storage Set',
    descriptionZh: '官方桌面收纳套装，包含主机底座、充电握把、收纳包。',
    descriptionEn:
      'Official tabletop set including dock, charging grip, and carrying case.',
    descriptionJa:
      '公式デスクトップセット、Dock、Charging Grip、Carry Case付き。',
    priceJpy: 4980,
    currency: 'JPY',
    images: [
      'https://images-na.ssl-images-amazon.com/images/I/71vqQUNMUBL._AC_SL1500_.jpg',
    ],
    categoryId: '',
    rating: 4.6,
    reviewCount: 892,
    salesCount: 456,
    status: ProductStatus.ACTIVE,
    sellerName: '任天堂官方认证店',
  },
  {
    platform: Platform.AMAZON,
    platformProductId: 'amazon:home:004',
    titleZh: '戴森 Dyson Airwrap 多功能卷发棒',
    titleEn: 'Dyson Airwrap Multi-Styler',
    titleJa: 'Dyson Airwrap マルチスタイルヤー',
    descriptionZh: '气流造型技术，减少高温损伤，适合多种发质，五种配件。',
    descriptionEn:
      'Airflow styling technology, less heat damage, for multiple hair types, 5 attachments.',
    descriptionJa:
      '气流スタイリング技術、熱ダメージ軽減、複数の髪質に対応、5つのアクセサリー。',
    priceJpy: 69800,
    currency: 'JPY',
    images: [
      'https://images-na.ssl-images-amazon.com/images/I/71NbXfRudOL._AC_SL1500_.jpg',
    ],
    categoryId: '',
    rating: 4.4,
    reviewCount: 2134,
    salesCount: 987,
    status: ProductStatus.ACTIVE,
    sellerName: 'Dyson公式',
  },
  {
    platform: Platform.RAKUTEN,
    platformProductId: 'rakuten:home:005',
    titleZh: '松下 nanoe X 空气净化器 F-VXU90',
    titleEn: 'Panasonic nanoe X Air Purifier F-VXU90',
    titleJa: 'シャープ 空気清浄機 F-VXU90',
    descriptionZh: 'nanoe X技术去除病毒细菌，PM2.5对应，Room认认真真花粉对应。',
    descriptionEn:
      'nanoe X technology removes viruses and bacteria, PM2.5 compliant, pollen protection.',
    descriptionJa: 'nanoe X技術でウイルス・細菌を除去、PM2.5対応、花粉対応。',
    priceJpy: 24800,
    currency: 'JPY',
    images: ['https://image.rakuten.co.jp/panasonic/cabinet/px/b0928_01.jpg'],
    categoryId: '',
    rating: 4.6,
    reviewCount: 1678,
    salesCount: 723,
    status: ProductStatus.ACTIVE,
    sellerName: 'Panasonic公式',
  },
];

// ==================== 价格计算辅助 ====================
function calcPrices(priceJpy: number) {
  return {
    priceCny: Math.round(priceJpy * EXCHANGE_RATE_JPY_TO_CNY * 100) / 100,
    priceUsd: Math.round(priceJpy * EXCHANGE_RATE_JPY_TO_USD * 100) / 100,
    exchangeRateUsed: EXCHANGE_RATE_JPY_TO_CNY,
  };
}

// ==================== 主函数 ====================
export async function runSeed(dataSource: DataSource): Promise<void> {
  const categoryRepo = dataSource.getRepository(Category);
  const productRepo = dataSource.getRepository(Product);

  console.log('🌱 开始种子数据导入...');

  // 1. 导入分类
  console.log('📂 导入分类...');
  for (const cat of categories) {
    const existing = await categoryRepo.findOne({ where: { slug: cat.slug } });
    if (existing) {
      console.log(`  ⏭️  分类已存在: ${cat.slug}`);
      categoryIdMap.set(cat.slug, existing.id);
    } else {
      const saved = categoryRepo.create(cat as Partial<Category>);
      const result = await categoryRepo.save(saved);
      categoryIdMap.set(cat.slug, result.id);
      console.log(`  ✅ 创建分类: ${cat.nameZh} (${cat.slug})`);
    }
  }

  // 2. 导入商品
  console.log('📦 导入商品...');
  let productCount = 0;
  for (const prod of products) {
    // 设置分类ID
    const categorySlug =
      Object.entries({
        electronics: 'electronics',
        fashion: 'fashion',
        'sports-outdoors': 'sports-outdoors',
        'books-media': 'books-media',
        'home-living': 'home-living',
      }).find(([slug]) => prod.platformProductId.includes(slug))?.[0] ||
      'electronics';

    prod.categoryId = categoryIdMap.get(categorySlug) || '';

    // 计算价格
    const { priceCny, priceUsd, exchangeRateUsed } = calcPrices(prod.priceJpy);

    const existing = await productRepo.findOne({
      where: {
        platform: prod.platform,
        platformProductId: prod.platformProductId,
      },
    });

    if (existing) {
      console.log(`  ⏭️  商品已存在: ${prod.titleZh}`);
      continue;
    }

    const productData = {
      ...prod,
      priceCny,
      priceUsd,
      exchangeRateUsed,
      imagesCount: prod.images?.length || 0,
      specifications: {},
      slug: prod.platformProductId.replace(/:/g, '-'),
      lastSyncedAt: new Date(),
    };

    const saved = productRepo.create(productData as Partial<Product>);
    await productRepo.save(saved);
    productCount++;
    console.log(`  ✅ 创建商品: ${prod.titleZh} @ ¥${prod.priceJpy}`);
  }

  console.log(`\n🎉 种子数据导入完成！`);
  console.log(`   - 分类: ${categories.length} 个`);
  console.log(`   - 商品: ${productCount} 个`);
  console.log(`   - 汇率: 1 JPY = ${EXCHANGE_RATE_JPY_TO_CNY} CNY`);
}
