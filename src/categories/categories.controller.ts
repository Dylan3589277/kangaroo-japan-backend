import { Controller, Get, Param, Query, NotFoundException } from "@nestjs/common";
import { CategoriesService } from "./categories.service";

@Controller("api/v1/categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // GET /categories - 全部分类
  @Get()
  async getCategories(@Query("lang") lang = "zh") {
    return this.categoriesService.getCategories(lang);
  }

  // GET /categories/:id - 单个分类
  @Get(":id")
  async getCategory(@Param("id") id: string, @Query("lang") lang = "zh") {
    const category = await this.categoriesService.getCategoryById(id, lang);
    if (!category) {
      throw new NotFoundException("Category not found");
    }
    return category;
  }

  // GET /categories/:id/products - 分类下的商品
  @Get(":id/products")
  async getCategoryProducts(
    @Param("id") id: string,
    @Query() query: any,
  ) {
    const category = await this.categoriesService.getCategoryById(id, query.lang || "zh");
    if (!category) {
      throw new NotFoundException("Category not found");
    }
    return this.categoriesService.getProductsByCategory(id, query);
  }
}
