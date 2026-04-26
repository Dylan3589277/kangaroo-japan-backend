import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, FindOptionsWhere } from 'typeorm';
import { YahooBid, YahooBidStatus } from './entities/yahoo-bid.entity';
import { YahooGoods } from './entities/yahoo-goods.entity';
import { DepositService } from '../deposit/deposit.service';

export interface BidResult {
  code: number;
  errmsg: string;
}

@Injectable()
export class YahooBidService {
  private readonly logger = new Logger(YahooBidService.name);
  private readonly API_BASE = 'https://app.kangaroo-japan.com';

  constructor(
    @InjectRepository(YahooBid)
    private bidRepository: Repository<YahooBid>,
    @InjectRepository(YahooGoods)
    private goodsRepository: Repository<YahooGoods>,
    private dataSource: DataSource,
    private depositService: DepositService,
  ) {}

  /**
   * 用户竞拍列表
   */
  async list(userId: string, status: number, page: number) {
    const limit = 20;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<YahooBid> = { userId };
    // 0=竞拍中, 2=成功, 3=其它
    if (status === 0) where.status = YahooBidStatus.BIDDING;
    else if (status === 2) where.status = YahooBidStatus.WON;
    else if (status === 3) where.status = YahooBidStatus.LOST;

    const [items, total] = await this.bidRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    // 补充商品信息
    const goodsNos = items.map((i) => i.goodsNo);
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
   * 出价（通过PHP后端代理）
   */
  async bid(
    userId: string,
    goodsNo: string,
    money: number,
  ): Promise<BidResult> {
    if (money <= 0) {
      throw new BadRequestException('请输入有效的出价金额');
    }

    // 检查押金
    const balance = await this.depositService.getBalance(userId);
    if (balance.balance <= 0) {
      throw new BadRequestException('请先充值押金');
    }

    // 通过PHP后端代理出价（过渡方案）
    try {
      const res = await fetch(`${this.API_BASE}/api/yahoo/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          goods_no: goodsNo,
          money: String(money),
        }),
      });
      const data = (await res.json()) as BidResult;

      // 记录出价
      const bid = this.bidRepository.create({
        userId,
        goodsNo,
        price: money,
        status: YahooBidStatus.BIDDING,
        isHigh: true,
      });
      await this.bidRepository.save(bid);

      return {
        code: data.code || 0,
        errmsg: data.errmsg || '出价成功',
      };
    } catch (e: unknown) {
      this.logger.error(
        `Bid failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw new BadRequestException('出价失败，请稍后重试');
    }
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
