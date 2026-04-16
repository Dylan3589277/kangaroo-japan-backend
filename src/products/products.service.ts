import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Product } from "./product.entity";
import { Category } from "./category.entity";

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
  ) {}

  async findAll(lang = "zh") {
    const products = await this.productsRepository.find({
      relations: ["category"],
      order: { createdAt: "DESC" },
    });
    return products.map((p) => this.formatProduct(p, lang));
  }

  async findById(id: string, lang = "zh") {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: ["category"],
    });
    return product ? this.formatProduct(product, lang) : null;
  }

  async search(query: string, lang = "zh") {
    const qb = this.productsRepository.createQueryBuilder("product");
    qb.where(
      `product.title_zh ILIKE :q OR product.title_en ILIKE :q OR product.title_ja ILIKE :q`,
      { q: `%${query}%` },
    ).orderBy("product.createdAt", "DESC");

    const products = await qb.getMany();
    return products.map((p) => this.formatProduct(p, lang));
  }

  async getCategories() {
    return this.categoriesRepository.find();
  }

  private formatProduct(product: Product, lang: string) {
    const titleKey = `title${lang.toUpperCase()}` as "titleZh" | "titleEn" | "titleJa";
    const descKey = `description${lang.toUpperCase()}` as "descriptionZh" | "descriptionEn" | "descriptionJa";
    return {
      id: product.id,
      platform: product.platform,
      platformProductId: product.platformProductId,
      title: product[titleKey] || product.titleJa || product.titleEn,
      description: product[descKey] || product.descriptionJa || product.descriptionEn,
      priceJpy: product.priceJpy,
      priceCny: product.priceCny,
      priceUsd: product.priceUsd,
      currency: product.currency,
      images: product.images,
      category: product.category,
      rating: product.rating,
      reviewCount: product.reviewCount,
      salesCount: product.salesCount,
      url: product.url,
    };
  }
}
