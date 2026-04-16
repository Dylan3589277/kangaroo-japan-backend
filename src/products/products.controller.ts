import { Controller, Get, Param, Query } from "@nestjs/common";
import { ProductsService } from "./products.service";

@Controller("api/v1/products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async getProducts(
    @Query("lang") lang = "zh",
    @Query("q") query?: string,
  ) {
    if (query) {
      return this.productsService.search(query, lang);
    }
    return this.productsService.findAll(lang);
  }

  @Get("categories")
  async getCategories() {
    return this.productsService.getCategories();
  }

  @Get(":id")
  async getProduct(
    @Param("id") id: string,
    @Query("lang") lang = "zh",
  ) {
    return this.productsService.findById(id, lang);
  }
}
