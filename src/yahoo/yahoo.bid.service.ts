import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, FindOptionsWhere } from 'typeorm';
import { YahooBid, YahooBidStatus } from './entities/yahoo-bid.entity';
import { YahooGoods, YahooGoodsStatus } from './entities/yahoo-goods.entity';

/** Provider Token for DI */
export const YAHOO_BID_PROVIDER = 'YAHOO_BID_PROVIDER';

/** Yahoo 外部竞拍接口抽象 */
export interface YahooExternalBidProvider {
  placeBid(goodsNo: string, money: number): Promise<{ code: number; errmsg: string }>;
}

/** 开发环境模拟 Provider（不出价到真实 Yahoo） */
export class MockYahooBidProvider implements YahooExternalBidProvider {
  async placeBid(_goodsNo: string, _money: number): Promise<{ code: number; errmsg: string }> {
    return { code: 0, errmsg: '模拟出价成功（开发环境）' };
  }
}

/** 生产环境通过 PHP 后端代理出价 */
export class PhpProxyYahooBidProvider implements YahooExternalBidProvider {
  private readonly API_BASE = 'https://app.kangaroo-japan.com';
  private readonly logger = new Logger(PhpProxyYahooBidProvider.name);

  async placeBid(goodsNo: string, money: number): Promise<{ code: number; errmsg: string }> {
    const res = await fetch(`${this.API_BASE}/api/yahoo/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        goods_no: goodsNo,
        money: String(money),
      }),
    });
    return (await res.json()) as { code: number; errmsg: string };
  }
}

export interface BidResult {
  code: number;
  errmsg: string;
}

@Injectable()
export class YahooBidService {
  private readonly logger = new Logger(YahooBidService.name);
  private readonly MIN_BID_INCREMENT = 1; // 最低加价单位（日元）

  constructor(
    @InjectRepository(YahooBid)
    private bidRepository: Repository<YahooBid>,
    @InjectRepository(YahooGoods)
    private goodsRepository: Repository<YahooGoods>,
    private dataSource: DataSource,
    @Inject(YAHOO_BID_PROVIDER)
    private externalProvider: YahooExternalBidProvider,
  ) {}

  /**
   * 用户竞拍列表
   */
  async list(userId: string, status: number, page: number) {
    const limit = 20;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<YahooBid> = { userId };
    if (status === 0) where.status = YahooBidStatus.BIDDING;
    else if (status === 2) where.status = YahooBidStatus.WON;
    else if (status === 3) where.status = YahooBidStatus.LOST;

    const [items, total] = await this.bidRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const goodsNos = [...new Set(items.map((i) => i.goodsNo))];
    const goodsMap = new Map<string, YahooGoods>();
    if (goodsNos.length > 0) {
      const goodsList = await this.goodsRepository.find({
        where: goodsNos.map((no) => ({ goodsNo: no })),
      });
      for (const g of goodsList) {
        goodsMap.set(g.goodsNo, g);
      }
    }

    const list = items.map((bid) => {
      const g = goodsMap.get(bid.goodsNo);
      return {
        id: bid.id,
        goods_no: bid.goodsNo,
        goods_name: g?.goodsName || '',
        cover: g?.cover || '',
        price: Number(bid.price),
        shop: '雅虎竞拍',
        status_txt: this.getStatusText(bid.status),
      };
    });

    return { list, totalPages: Math.ceil(total / limit) };
  }

  /**
   * 出价（事务保护，含并发控制）
   */
  async bid(
    userId: string,
    goodsNo: string,
    money: number,
  ): Promise<BidResult> {
    if (money <= 0) {
      throw new BadRequestException('请输入有效的出价金额');
    }

    // 使用事务 + 悲观锁保护
    return await this.dataSource.transaction(async (manager) => {
      // 1. 锁定商品行，防止并发操作
      const goods = await manager.findOne(YahooGoods, {
        where: { goodsNo },
        lock: { mode: 'pessimistic_write' },
      });

      if (!goods) {
        throw new BadRequestException('商品不存在');
      }

      // 2. 校验商品状态
      if (goods.status !== YahooGoodsStatus.ACTIVE) {
        throw new BadRequestException('该商品已结束竞拍');
      }

      // 3. 校验竞拍时间
      if (goods.leftTimestamp <= 0) {
        throw new BadRequestException('该商品已结束竞拍');
      }

      // 4. 校验出价金额 >= 当前价 + 最低加价
      const currentPrice = Number(goods.bidPrice) || Number(goods.price);
      if (money < currentPrice + this.MIN_BID_INCREMENT) {
        throw new BadRequestException(
          `出价金额需不低于 ¥${currentPrice + this.MIN_BID_INCREMENT}`,
        );
      }

      // 5. 检查用户之前是否出价过
      const existingBid = await manager.findOne(YahooBid, {
        where: {
          userId,
          goodsNo,
          status: YahooBidStatus.BIDDING,
        },
      });
      if (existingBid) {
        if (Number(existingBid.price) >= money) {
          throw new BadRequestException('您的当前出价已经高于或等于此金额');
        }
        existingBid.price = money;
        existingBid.isHigh = true;
        await manager.save(existingBid);
      } else {
        const bid = manager.create(YahooBid, {
          userId,
          goodsNo,
          price: money,
          status: YahooBidStatus.BIDDING,
          isHigh: true,
          placedAt: new Date(),
        });
        await manager.save(bid);
      }

      // 6. 更新商品当前出价
      goods.bidPrice = money;
      goods.bidNum = (goods.bidNum || 0) + 1;
      await manager.save(goods);
    }).then(async () => {
      // 事务已提交，异步调用外部 Provider
      try {
        const result = await this.externalProvider.placeBid(goodsNo, money);
        return {
          code: result.code,
          errmsg: result.errmsg || '出价成功',
        };
      } catch (e: unknown) {
        this.logger.warn(
          `External bid call failed but local record saved: ${e instanceof Error ? e.message : String(e)}`,
        );
        return {
          code: 0,
          errmsg: '出价已记录，等待外部确认',
        };
      }
    });
  }

  /**
   * 结算过期竞拍：将到期商品的所有出价转为 WON/LOST
   */
  async settleExpiredAuctions(): Promise<number> {
    const now = new Date();

    const expiredGoods = await this.goodsRepository.find({
      where: { status: YahooGoodsStatus.ACTIVE },
    });

    const actualExpired = expiredGoods.filter(
      (g) => g.leftTimestamp <= 0 || (g.endTime && new Date(g.endTime) < now),
    );

    let settledCount = 0;

    for (const goods of actualExpired) {
      await this.dataSource.transaction(async (manager) => {
        goods.status = YahooGoodsStatus.ENDED;
        await manager.save(goods);

        const bids = await manager.find(YahooBid, {
          where: { goodsNo: goods.goodsNo },
          order: { price: 'DESC' },
        });

        if (bids.length === 0) return;

        const highestPrice = Number(bids[0].price);
        for (const bid of bids) {
          if (bid.status !== YahooBidStatus.BIDDING) continue;
          if (Number(bid.price) === highestPrice) {
            bid.status = YahooBidStatus.WON;
          } else {
            bid.status = YahooBidStatus.LOST;
          }
          bid.settledAt = new Date();
          await manager.save(bid);
        }
      });
      settledCount++;
    }

    return settledCount;
  }

  private getStatusText(status: YahooBidStatus): string {
    switch (status) {
      case YahooBidStatus.BIDDING:
        return '竞拍中';
      case YahooBidStatus.WON:
        return '已中标';
      case YahooBidStatus.LOST:
        return '未中标';
      case YahooBidStatus.CANCELLED:
        return '已取消';
      default:
        return '';
    }
  }
}
