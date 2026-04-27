import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual } from 'typeorm';
import { Product, Platform, ProductStatus } from './product.entity';
import { Category } from './category.entity';
import { PriceHistory } from './price-history.entity';
import { ProductQueryDto } from './dto/product-query.dto';
export { ProductQueryDto } from './dto/product-query.dto';

export interface ProductListResponse {
  data: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters?: {
    platforms: string[];
    categories: any[];
    priceRange: { min: number; max: number };
  };
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @InjectRepository(PriceHistory)
    private priceHistoryRepository: Repository<PriceHistory>,
  ) {}

  // ==================== 商品列表 ====================
  async findAll(query: ProductQueryDto): Promise<ProductListResponse> {
    const {
      lang = 'zh',
      page = 1,
      limit = 20,
      platform,
      categoryId,
      priceMin,
      priceMax,
      sort = 'createdAt_desc',
      status,
    } = query;

    // 注意：暂不使用 leftJoin，避免 TypeORM getMany() bug
    const qb = this.productsRepository.createQueryBuilder('product');

    // 平台过滤
    if (platform) {
      const platforms = platform.split(',') as Platform[];
      qb.andWhere('product.platform IN (:...platforms)', { platforms });
    }

    // 分类过滤
    if (categoryId) {
      qb.andWhere('product.category_id = :categoryId', { categoryId });
    }

    // 价格范围
    if (priceMin !== undefined) {
      qb.andWhere('product.price_jpy >= :priceMin', { priceMin });
    }
    if (priceMax !== undefined) {
      qb.andWhere('product.price_jpy <= :priceMax', { priceMax });
    }

    // 状态过滤
    const statusFilter = status || ProductStatus.ACTIVE;
    qb.andWhere('product.status = :status', { status: statusFilter });

    // 排序 - 安全处理，防止 TypeORM 排序bug
    const [sortField, sortOrder] = sort.split('_');
    const allowedSortFields: Record<string, string> = {
      createdAt: 'product.created_at',
      price: 'product.price_jpy',
      rating: 'product.rating',
      sales: 'product.sales_count',
    };
    const safeSortField = allowedSortFields[sortField] || 'product.created_at';
    const safeSortOrder = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(safeSortField, safeSortOrder);

    // 分页
    const total = await qb.getCount();
    qb.skip((page - 1) * limit).take(limit);

    const products = await qb.getMany();

    return {
      data: products.map((p) => this.formatProduct(p, lang)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  // ==================== 商品详情 ====================
  async findById(id: string, lang = 'zh') {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!product) return null;
    return this.formatProduct(product, lang);
  }

  // ==================== 搜索商品 ====================
  async search(
    query: string,
    lang = 'zh',
    options: { page?: number; limit?: number } = {},
  ): Promise<ProductListResponse> {
    const { page = 1, limit = 20 } = options;

    // 修复 TypeORM leftJoin getMany() bug：不使用 leftJoinAndSelect，改用独立查询
    const qb = this.productsRepository.createQueryBuilder('product');
    qb.where(
      `product.title_zh ILIKE :q OR product.title_en ILIKE :q OR product.title_ja ILIKE :q OR product.title_th ILIKE :q OR product.title_vi ILIKE :q OR product.title_id ILIKE :q OR product.description_zh ILIKE :q OR product.description_en ILIKE :q OR product.description_ja ILIKE :q OR product.description_th ILIKE :q OR product.description_vi ILIKE :q OR product.description_id ILIKE :q`,
      { q: `%${query}%` },
    );
    qb.andWhere('product.status = :status', { status: ProductStatus.ACTIVE });

    const total = await qb.getCount();
    qb.orderBy('product.rating', 'DESC', 'NULLS LAST');
    qb.skip((page - 1) * limit).take(limit);

    const products = await qb.getMany();

    // 独立查询分类数据，避免 leftJoin bug
    const categoryIds = [
      ...new Set(products.map((p) => p.categoryId).filter(Boolean)),
    ];
    const categoriesMap = new Map<string, Category>();
    if (categoryIds.length > 0) {
      const categories = await this.categoriesRepository.findBy({
        id: In(categoryIds),
      });
      categories.forEach((c) => categoriesMap.set(c.id, c));
    }

    return {
      data: products.map((p) => {
        const productWithCategory = {
          ...p,
          category: categoriesMap.get(p.categoryId),
        } as Product;
        return this.formatProduct(productWithCategory, lang);
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  // ==================== 比价 ====================
  async compare(productIds: string[], lang = 'zh') {
    if (!productIds || productIds.length === 0) {
      return { products: [], cheapest: null };
    }

    const products = await this.productsRepository.find({
      where: { id: In(productIds) },
      relations: ['category'],
    });

    const formattedProducts = products.map((p) => this.formatProduct(p, lang));

    // 找出最低价
    const sorted = [...formattedProducts].sort(
      (a, b) => a.priceCny - b.priceCny,
    );
    const cheapest = sorted[0];
    const original = sorted[sorted.length - 1];

    let savingsCny = 0;
    let savingsPercent = 0;
    if (cheapest && original && cheapest.id !== original.id) {
      savingsCny = original.priceCny - cheapest.priceCny;
      savingsPercent = Math.round((savingsCny / original.priceCny) * 100);
    }

    return {
      products: formattedProducts,
      cheapest: cheapest
        ? {
            platform: cheapest.platform,
            priceCny: cheapest.priceCny,
            priceJpy: cheapest.priceJpy,
            savingsCny,
            savingsPercent,
          }
        : null,
    };
  }

  // ==================== 价格历史 ====================
  async getPriceHistory(productId: string, days = 30, currency = 'CNY') {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });
    if (!product) return null;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const history = await this.priceHistoryRepository.find({
      where: {
        productId,
        recordedAt: MoreThanOrEqual(startDate),
      },
      order: { recordedAt: 'ASC' },
    });

    const priceKey =
      currency === 'USD'
        ? 'priceUsd'
        : currency === 'JPY'
          ? 'priceJpy'
          : 'priceCny';

    const historyData = history.map((h) => ({
      date: h.recordedAt.toISOString().split('T')[0],
      price: h[priceKey],
    }));

    // 统计
    const prices = historyData.map((h) => h.price);
    const currentPrice = product.priceCny;

    return {
      productId,
      currency,
      history: historyData,
      statistics: {
        currentPrice,
        lowestPrice: prices.length > 0 ? Math.min(...prices) : currentPrice,
        highestPrice: prices.length > 0 ? Math.max(...prices) : currentPrice,
        averagePrice:
          prices.length > 0
            ? prices.reduce((a, b) => a + b, 0) / prices.length
            : currentPrice,
        priceTrend: this.calculateTrend(historyData),
      },
    };
  }

  // ==================== 获取分类列表 ====================
  async getCategories(lang = 'zh') {
    const categories = await this.categoriesRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', level: 'ASC' },
    });

    return categories.map((c) => this.formatCategory(c, lang));
  }

  // ==================== 获取单个分类 ====================
  async getCategoryById(id: string, lang = 'zh') {
    const category = await this.categoriesRepository.findOne({ where: { id } });
    if (!category) return null;
    return this.formatCategory(category, lang);
  }

  // ==================== 获取分类下的商品 ====================
  async getProductsByCategory(
    categoryId: string,
    query: ProductQueryDto,
  ): Promise<ProductListResponse> {
    return this.findAll({ ...query, categoryId });
  }

  // ==================== 私有方法 ====================
  private formatProduct(product: Product, lang: string) {
    const titleKey = `title${lang.charAt(0).toUpperCase() + lang.slice(1)}` as
      | 'titleZh'
      | 'titleEn'
      | 'titleJa'
      | 'titleTh'
      | 'titleVi'
      | 'titleId';
    const descKey =
      `description${lang.charAt(0).toUpperCase() + lang.slice(1)}` as
        | 'descriptionZh'
        | 'descriptionEn'
        | 'descriptionJa'
        | 'descriptionTh'
        | 'descriptionVi'
        | 'descriptionId';

    // 平台名称映射
    const platformNames: Record<string, Record<string, string>> = {
      amazon: { zh: '亚马逊', en: 'Amazon', ja: 'アマゾン' },
      mercari: { zh: 'Mercari', en: 'Mercari', ja: 'メルカリ' },
      rakuten: { zh: '乐天', en: 'Rakuten', ja: '楽天' },
      yahoo: { zh: 'Yahoo', en: 'Yahoo', ja: 'Yahoo!オークション' },
    };

    // 本地货币价格计算（基于 exchangeRateUsed 或固定汇率）
    const jpyPrice = Number(product.priceJpy) || 0;
    const exchangeRate = Number(product.exchangeRateUsed) || 0;
    // 固定汇率用于目标货币（当 exchangeRateUsed 无对应值时）
    const pricePhp = Math.round(jpyPrice * 0.36 * 100) / 100;
    const priceMyr = Math.round(jpyPrice * 0.031 * 100) / 100;
    const priceSgd = Math.round(jpyPrice * 0.0093 * 100) / 100;

    return {
      id: product.id,
      platform: product.platform,
      platformName: platformNames[product.platform]?.[lang] || product.platform,
      platformProductId: product.platformProductId,
      platformUrl: product.platformUrl,
      title:
        product[titleKey] ||
        product.titleZh ||
        product.titleJa ||
        product.titleEn,
      titleZh: product.titleZh,
      titleEn: product.titleEn,
      titleJa: product.titleJa,
      titleTh: product.titleTh,
      titleVi: product.titleVi,
      titleId: product.titleId,
      description:
        product[descKey] ||
        product.descriptionZh ||
        product.descriptionJa ||
        product.descriptionEn,
      descriptionZh: product.descriptionZh,
      descriptionEn: product.descriptionEn,
      descriptionJa: product.descriptionJa,
      descriptionTh: product.descriptionTh,
      descriptionVi: product.descriptionVi,
      descriptionId: product.descriptionId,
      priceJpy: jpyPrice,
      priceCny: Number(product.priceCny) || 0,
      priceUsd: Number(product.priceUsd) || 0,
      pricePhp,
      priceMyr,
      priceSgd,
      currency: product.currency,
      exchangeRateUsed: exchangeRate,
      images: product.images || [],
      imagesCount: product.imagesCount || 0,
      categoryId: product.categoryId,
      category: product.category
        ? this.formatCategory(product.category, lang)
        : null,
      status: product.status,
      rating: Number(product.rating) || null,
      reviewCount: product.reviewCount || 0,
      salesCount: product.salesCount || 0,
      specifications: product.specifications || {},
      sellerId: product.sellerId,
      sellerName: product.sellerName,
      slug: product.slug,
      inStock: product.status === ProductStatus.ACTIVE,
      lastSyncedAt: product.lastSyncedAt,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private formatCategory(category: Category, lang: string) {
    const nameKey = `name${lang.charAt(0).toUpperCase() + lang.slice(1)}` as
      | 'nameZh'
      | 'nameEn'
      | 'nameJa'
      | 'nameKo'
      | 'nameTh'
      | 'nameId'
      | 'nameVi';
    return {
      id: category.id,
      parentId: category.parentId,
      level: category.level,
      sortOrder: category.sortOrder,
      name:
        category[nameKey] ||
        category.nameZh ||
        category.nameJa ||
        category.nameEn,
      nameZh: category.nameZh,
      nameEn: category.nameEn,
      nameJa: category.nameJa,
      nameKo: category.nameKo,
      nameTh: category.nameTh,
      nameId: category.nameId,
      nameVi: category.nameVi,
      iconUrl: category.iconUrl,
      path: category.path || [],
      isActive: category.isActive,
      slug: category.slug,
    };
  }

  private calculateTrend(
    history: { date: string; price: number }[],
  ): 'up' | 'down' | 'stable' {
    if (history.length < 2) return 'stable';
    const recent = history.slice(-7); // 最近7天
    if (recent.length < 2) return 'stable';

    const first = recent[0].price;
    const last = recent[recent.length - 1].price;
    const change = ((last - first) / first) * 100;

    if (change > 2) return 'up';
    if (change < -2) return 'down';
    return 'stable';
  }
}
