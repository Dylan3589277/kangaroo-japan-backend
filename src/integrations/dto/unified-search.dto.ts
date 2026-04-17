/**
 * 统一商品搜索结果 DTO
 */
export class UnifiedSearchResultDto {
  items: UnifiedProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  platforms: {
    rakuten: { found: number; returned: number };
    yahoo: { found: number; returned: number };
  };
}

export class UnifiedProduct {
  id: string;
  platform: string;
  platformName: string;
  title: string;
  priceJpy: number;
  priceCny: number;
  priceUsd: number;
  currency: string;
  images: string[];
  imagesCount: number;
  rating: number | null;
  reviewCount: number;
  salesCount: number;
  inStock: boolean;
  status: string;
  url: string;
  brand?: string;
  itemCondition?: string;
  shipping?: string;
}
