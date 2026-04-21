import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import { ProductQueryDto } from "./dto/product-query.dto";
import { ProductsService } from "./products.service";

@Controller("api/v1/products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // GET /products - 商品列表
  @Get()
  async getProducts(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  // GET /products/search - 搜索商品
  @Get("search")
  async searchProducts(
    @Query("q") q: string,
    @Query("lang") lang = "zh",
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    if (!q) {
      return { data: [], pagination: null };
    }
    const safePage = Math.max(1, Math.min(page, 10000));
    const safeLimit = Math.max(1, Math.min(limit, 100));
    return this.productsService.search(q, lang, { page: safePage, limit: safeLimit });
  }

  // GET /products/compare - 比价
  @Get("compare")
  async compareProducts(
    @Query("ids") ids: string,
    @Query("lang") lang = "zh",
  ) {
    if (!ids) {
      return { products: [], cheapest: null };
    }
    const productIds = ids.split(",").filter(Boolean);
    return this.productsService.compare(productIds, lang);
  }

  // GET /products/:id/price-history - 价格历史
  @Get(":id/price-history")
  async getPriceHistory(
    @Param("id") id: string,
    @Query("days") days?: number,
    @Query("currency") currency?: string,
  ) {
    const result = await this.productsService.getPriceHistory(
      id,
      days || 30,
      currency || "CNY",
    );
    if (!result) {
      throw new NotFoundException("Product not found");
    }
    return result;
  }

  // GET /products/categories - 分类列表
  @Get("categories")
  async getCategories(@Query("lang") lang = "zh") {
    return this.productsService.getCategories(lang);
  }

  // GET /products/:id - 商品详情
  @Get(":id")
  async getProduct(
    @Param("id") id: string,
    @Query("lang") lang = "zh",
  ) {
    const product = await this.productsService.findById(id, lang);
    if (!product) {
      throw new NotFoundException("Product not found");
    }
    return product;
  }
}
