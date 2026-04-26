import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { YahooGoods, YahooGoodsStatus } from './entities/yahoo-goods.entity';

interface GoodsDetailResponse {
  goods_name: string;
  price: number;
  bid_price: number;
  fastprice: number;
  bid_num: number;
  left_timestamp: number;
  end_time: string | null;
  seller: string | null;
  seller_id: string | null;
  seller_address: string | null;
  rate_num: string | null;
  rate_percent: string | null;
  imgurls: string[];
  content: string | null;
  extras: { name: string; value: string }[];
  url: string | null;
  price_title: string | null;
  canbid: number;
  is_high: boolean;
  collect: boolean;
  bid_status: string;
  last_info: null;
  tipList: string[];
  rate: string;
}

interface GoodsListResult {
  goodsList: YahooGoods[];
  totalPages: number;
  total: number;
  page: number;
}

@Injectable()
export class YahooGoodsService {
  private readonly logger = new Logger(YahooGoodsService.name);
  private readonly API_BASE = 'https://app.kangaroo-japan.com';

  constructor(
    @InjectRepository(YahooGoods)
    private goodsRepository: Repository<YahooGoods>,
  ) {}

  /**
   * 商品列表（搜索/分类/排序）
   */
  async list(dto: {
    kw?: string;
    cat?: string;
    sort?: string;
    page?: number;
  }): Promise<GoodsListResult> {
    const page = dto.page || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const qb = this.goodsRepository
      .createQueryBuilder('g')
      .where('g.status = :status', { status: YahooGoodsStatus.ACTIVE });

    if (dto.kw) {
      qb.andWhere('g.goodsName LIKE :kw', { kw: `%${dto.kw}%` });
    }
    if (dto.cat) {
      qb.andWhere('g.categoryId = :cat', { cat: Number(dto.cat) });
    }

    // 排序
    switch (dto.sort) {
      case 'new_d':
        qb.orderBy('g.createdAt', 'DESC');
        break;
      case 'cbids_a':
        qb.orderBy('g.bidPrice', 'ASC');
        break;
      case 'cbids_d':
        qb.orderBy('g.bidPrice', 'DESC');
        break;
      case 'end_a':
        qb.orderBy('g.leftTimestamp', 'ASC');
        break;
      case 'end_d':
        qb.orderBy('g.leftTimestamp', 'DESC');
        break;
      default:
        qb.orderBy('g.createdAt', 'DESC');
    }

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      goodsList: items,
      totalPages: Math.ceil(total / limit),
      total,
      page,
    };
  }

  /**
   * 商品详情
   */
  async detail(
    goodsNo: string,
    _userId?: string,
  ): Promise<GoodsDetailResponse | null> {
    const goods = await this.goodsRepository.findOne({ where: { goodsNo } });
    if (!goods) {
      return null;
    }

    // 组装详情返回
    return {
      goods_name: goods.goodsName,
      price: Number(goods.price),
      bid_price: Number(goods.bidPrice),
      fastprice: Number(goods.fastprice),
      bid_num: goods.bidNum,
      left_timestamp: goods.leftTimestamp,
      end_time: goods.endTime,
      seller: goods.seller,
      seller_id: goods.sellerId,
      seller_address: goods.sellerAddress,
      rate_num: goods.rateNum,
      rate_percent: goods.ratePercent,
      imgurls: goods.images,
      content: goods.content,
      extras: goods.extras,
      url: goods.url,
      price_title: goods.priceTitle,
      canbid: goods.leftTimestamp > 0 ? 1 : 0,
      is_high: false,
      collect: false,
      bid_status: '',
      last_info: null,
      tipList: [
        '1、当前最高价 310 日元。',
        '2、系统自动出价，直到您的出价被超过。',
        '3、如果没人出价高于您，您拍卖成功。',
        '4、拍卖结束前如果出价被超过会跳转到待出价。',
      ],
      rate: '0.047', // 汇率
    };
  }

  /**
   * 同步商品数据（从PHP后端拉取）
   * 注意：这是过渡方案，后续应直接调Yahoo API
   */
  async fetchFromLegacy(
    goodsNo: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch(
        `${this.API_BASE}/api/goods/ydetail?id=${goodsNo}`,
      );
      const data: { code: number; data?: Record<string, unknown> } =
        (await res.json()) as { code: number; data?: Record<string, unknown> };
      if (data.code === 0) {
        return data.data ?? null;
      }
      return null;
    } catch (e: unknown) {
      this.logger.error(
        `Fetch legacy yahoo detail failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }
}
