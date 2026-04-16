import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Category } from "../products/category.entity";
import { Product, ProductStatus } from "../products/product.entity";

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async getCategories(lang = "zh") {
    const categories = await this.categoriesRepository.find({
      where: { isActive: true },
      order: { sortOrder: "ASC", level: "ASC" },
    });

    return categories.map((c) => this.formatCategory(c, lang));
  }

  async getCategoryById(id: string, lang = "zh") {
    const category = await this.categoriesRepository.findOne({ where: { id } });
    if (!category) return null;
    return this.formatCategory(category, lang);
  }

  async getProductsByCategory(categoryId: string, query: any) {
    const { lang = "zh", page = 1, limit = 20, sort = "createdAt_desc" } = query;

    const qb = this.productsRepository.createQueryBuilder("product");
    qb.leftJoinAndSelect("product.category", "category");
    qb.where("product.category_id = :categoryId", { categoryId });
    qb.andWhere("product.status = :status", { status: ProductStatus.ACTIVE });

    const [sortField, sortOrder] = sort.split("_");
    const orderMap: Record<string, string> = {
      createdAt: "product.created_at",
      price: "product.price_jpy",
      rating: "product.rating",
      sales: "product.sales_count",
    };
    qb.orderBy(orderMap[sortField] || "product.created_at", sortOrder?.toUpperCase() as "ASC" | "DESC" || "DESC");

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

  private formatCategory(category: Category, lang: string) {
    const nameKey = `name${lang.charAt(0).toUpperCase() + lang.slice(1)}` as "nameZh" | "nameEn" | "nameJa";
    return {
      id: category.id,
      parentId: category.parentId,
      level: category.level,
      sortOrder: category.sortOrder,
      name: category[nameKey] || category.nameZh || category.nameJa || category.nameEn,
      nameZh: category.nameZh,
      nameEn: category.nameEn,
      nameJa: category.nameJa,
      iconUrl: category.iconUrl,
      path: category.path || [],
      isActive: category.isActive,
      slug: category.slug,
    };
  }

  private formatProduct(product: Product, lang: string) {
    const titleKey = `title${lang.charAt(0).toUpperCase() + lang.slice(1)}` as "titleZh" | "titleEn" | "titleJa";
    const platformNames: Record<string, Record<string, string>> = {
      amazon: { zh: "亚马逊", en: "Amazon", ja: "アマゾン" },
      mercari: { zh: "Mercari", en: "Mercari", ja: "メルカリ" },
      rakuten: { zh: "乐天", en: "Rakuten", ja: "楽天" },
      yahoo: { zh: "Yahoo", en: "Yahoo", ja: "Yahoo!オークション" },
    };

    return {
      id: product.id,
      platform: product.platform,
      platformName: platformNames[product.platform]?.[lang] || product.platform,
      title: product[titleKey] || product.titleZh || product.titleJa || product.titleEn,
      priceJpy: Number(product.priceJpy),
      priceCny: Number(product.priceCny) || 0,
      priceUsd: Number(product.priceUsd) || 0,
      images: product.images || [],
      imagesCount: product.imagesCount || 0,
      categoryId: product.categoryId,
      status: product.status,
      rating: Number(product.rating) || null,
      reviewCount: product.reviewCount || 0,
      salesCount: product.salesCount || 0,
      inStock: product.status === ProductStatus.ACTIVE,
    };
  }
}
