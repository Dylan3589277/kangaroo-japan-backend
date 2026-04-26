# Yahoo竞拍系统迁移方案

## 概述

把PHP后端（https://app.kangaroo-japan.com/）的Yahoo竞拍功能迁移到NestJS项目。

**项目路径：** `/Users/hulonghua/workspace/kangaroo-japan-backend/`

## 表结构设计

### 1. yahoo_goods — Yahoo拍卖商品表

```sql
CREATE TABLE yahoo_goods (
  id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4(),
  goods_no VARCHAR(64) NOT NULL UNIQUE,          -- Yahoo商品ID
  goods_name TEXT NOT NULL,                        -- 商品名
  price DECIMAL(12,2) DEFAULT 0,                   -- 当前价格
  bid_price DECIMAL(12,2) DEFAULT 0,               -- 现价（竞拍价）
  fastprice DECIMAL(12,2) DEFAULT 0,               -- 一口价
  cover TEXT,
  images JSON DEFAULT '[]',                        -- 多张图片
  seller VARCHAR(255),
  seller_id VARCHAR(255),
  seller_address VARCHAR(255),
  rate_num VARCHAR(64),                            -- 卖家评价数
  rate_percent VARCHAR(64),                        -- 好评率
  bid_num INT DEFAULT 0,                           -- 出价次数
  content TEXT,                                     -- HTML商品介绍
  description TEXT,                                 -- 文字描述
  extras JSON DEFAULT '[]',                        -- 附属信息 [{name,value}]
  url TEXT,                                         -- 原始链接
  end_time VARCHAR(128),                            -- 截止时间
  left_timestamp INT DEFAULT 0,                    -- 剩余秒数
  price_title VARCHAR(32),                          -- '即決' 或 null
  category_id INT DEFAULT 0,
  status VARCHAR(32) DEFAULT 'active',              -- active, ended, sold
  raw_data JSON,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_yahoo_goods_no ON yahoo_goods(goods_no);
CREATE INDEX idx_yahoo_status ON yahoo_goods(status);
CREATE INDEX idx_yahoo_category ON yahoo_goods(category_id);
```

### 2. yahoo_bids — 用户出价记录

```sql
CREATE TABLE yahoo_bids (
  id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(36) NOT NULL,
  goods_no VARCHAR(64) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  status VARCHAR(32) DEFAULT 'bidding',            -- bidding竞拍中, won已中标, lost未中标, cancelled已取消
  is_high BIT DEFAULT 0,                            -- 是否当前最高价
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_yahoo_bids_user ON yahoo_bids(user_id);
CREATE INDEX idx_yahoo_bids_goods ON yahoo_bids(goods_no);
CREATE INDEX idx_yahoo_bids_status ON yahoo_bids(status);
```

## API设计

所有API路径前缀：`/api/v1/yahoo`

| 方法 | 路径 | 说明 | 对应PHP原API |
|------|------|------|-------------|
| GET | `/goods` | 商品列表搜索/分类 | `api/goods/yahoos` |
| GET | `/goods/:goodsNo` | 商品详情 | `api/goods/ydetail` |
| GET | `/goods/deliveryfee` | 查询运费 | `api/goods/deliveryfee` |
| POST | `/bid` | 出价 | `api/yahoo/bid` |
| GET | `/bids/list` | 我的竞拍列表 | `api/yahoo/index` |
| GET | `/bids/history` | 出价历史 | - |
| GET | `/seller/:sellerId` | 卖家商品列表 | - |

## 代码结构

```
src/yahoo/
├── yahoo.module.ts          -- 模块定义
├── yahoo.controller.ts      -- 控制器（所有API）
├── yahoo.service.ts         -- 业务逻辑
├── yahoo.goods.service.ts   -- 商品搜索/同步
├── yahoo.bid.service.ts     -- 出价逻辑
├── entities/
│   ├── yahoo-goods.entity.ts
│   └── yahoo-bid.entity.ts
└── dto/
    ├── goods-list.dto.ts
    ├── goods-detail.dto.ts
    ├── create-bid.dto.ts
    ├── bid-list.dto.ts
    └── delivery-fee.dto.ts
```

## 详细实现

### entity: yahoo-goods.entity.ts

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('yahoo_goods')
@Index('idx_yahoo_goods_no', ['goodsNo'], { unique: true })
@Index('idx_yahoo_status', ['status'])
export class YahooGoods {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'goods_no', length: 64, unique: true })
  goodsNo: string;

  @Column({ name: 'goods_name', type: 'text' })
  goodsName: string;

  @Column({ name: 'price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  price: number;

  @Column({ name: 'bid_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  bidPrice: number;

  @Column({ name: 'fastprice', type: 'decimal', precision: 12, scale: 2, default: 0 })
  fastprice: number;

  @Column({ name: 'cover', type: 'text', nullable: true })
  cover: string;

  @Column({ name: 'images', type: 'json', default: '[]' })
  images: string[];

  @Column({ name: 'seller', length: 255, nullable: true })
  seller: string;

  @Column({ name: 'seller_id', length: 255, nullable: true })
  sellerId: string;

  @Column({ name: 'seller_address', length: 255, nullable: true })
  sellerAddress: string;

  @Column({ name: 'rate_num', length: 64, nullable: true })
  rateNum: string;

  @Column({ name: 'rate_percent', length: 64, nullable: true })
  ratePercent: string;

  @Column({ name: 'bid_num', type: 'int', default: 0 })
  bidNum: number;

  @Column({ name: 'content', type: 'text', nullable: true })
  content: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @Column({ name: 'extras', type: 'json', default: '[]' })
  extras: { name: string; value: string }[];

  @Column({ name: 'url', type: 'text', nullable: true })
  url: string;

  @Column({ name: 'end_time', length: 128, nullable: true })
  endTime: string;

  @Column({ name: 'left_timestamp', type: 'int', default: 0 })
  leftTimestamp: number;

  @Column({ name: 'price_title', length: 32, nullable: true })
  priceTitle: string;

  @Column({ name: 'category_id', type: 'int', default: 0 })
  categoryId: number;

  @Column({ name: 'status', length: 32, default: 'active' })
  status: string;

  @Column({ name: 'raw_data', type: 'json', nullable: true })
  rawData: any;

  @Column({ name: 'last_synced_at', type: 'timestamp', nullable: true })
  lastSyncedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 计算字段（不存数据库）
  canBid: number;      // 1=可出价, 0=不可
  isHigh: boolean;     // 是否当前最高
  bidStatus: string;   // 出价状态文本
  lastInfo: { price: number };
  tipList: string[];
  collect: boolean;
}

export enum YahooGoodsStatus {
  ACTIVE = 'active',
  ENDED = 'ended',
  SOLD = 'sold',
}
```

### entity: yahoo-bid.entity.ts

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum YahooBidStatus {
  BIDDING = 'bidding',
  WON = 'won',
  LOST = 'lost',
  CANCELLED = 'cancelled',
}

@Entity('yahoo_bids')
@Index('idx_yahoo_bids_user', ['userId'])
@Index('idx_yahoo_bids_goods', ['goodsNo'])
export class YahooBid {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'goods_no', length: 64 })
  goodsNo: string;

  @Column({ name: 'price', type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({ name: 'status', type: 'enum', enum: YahooBidStatus, default: YahooBidStatus.BIDDING })
  status: YahooBidStatus;

  @Column({ name: 'is_high', type: 'boolean', default: false })
  isHigh: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### dto: goods-list.dto.ts

```typescript
import { IsOptional, IsInt, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GoodsListDto {
  @IsOptional()
  @IsString()
  kw?: string;

  @IsOptional()
  @IsString()
  cat?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  lng?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
}
```

### dto: create-bid.dto.ts

```typescript
import { IsString, IsNumber, Min } from 'class-validator';

export class CreateBidDto {
  @IsString()
  goodsNo: string;

  @IsNumber()
  @Min(1)
  money: number;
}
```

### dto: bid-list.dto.ts

```typescript
import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BidListDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  status?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
}
```

### yahoo.goods.service.ts — 商品搜索/详情

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { YahooGoods, YahooGoodsStatus } from './entities/yahoo-goods.entity';

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
  async list(dto: { kw?: string; cat?: string; sort?: string; page?: number }) {
    const page = dto.page || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const qb = this.goodsRepository.createQueryBuilder('g')
      .where('g.status = :status', { status: YahooGoodsStatus.ACTIVE });

    if (dto.kw) {
      qb.andWhere('g.goodsName LIKE :kw', { kw: `%${dto.kw}%` });
    }
    if (dto.cat) {
      qb.andWhere('g.categoryId = :cat', { cat: Number(dto.cat) });
    }

    // 排序
    switch (dto.sort) {
      case 'new_d': qb.orderBy('g.createdAt', 'DESC'); break;
      case 'cbids_a': qb.orderBy('g.bidPrice', 'ASC'); break;
      case 'cbids_d': qb.orderBy('g.bidPrice', 'DESC'); break;
      case 'end_a': qb.orderBy('g.leftTimestamp', 'ASC'); break;
      case 'end_d': qb.orderBy('g.leftTimestamp', 'DESC'); break;
      default: qb.orderBy('g.createdAt', 'DESC');
    }

    const [items, total] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

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
  async detail(goodsNo: string, userId?: string) {
    const goods = await this.goodsRepository.findOne({ where: { goodsNo } });
    if (!goods) {
      return null;
    }

    // 组装详情返回
    return {
      goods_name: goods.goodsName,
      price: goods.price,
      bid_price: goods.bidPrice,
      fastprice: goods.fastprice,
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
      rate: '0.047',  // 汇率
    };
  }

  /**
   * 同步商品数据（从PHP后端拉取）
   * 注意：这是过渡方案，后续应直接调Yahoo API
   */
  async fetchFromLegacy(goodsNo: string): Promise<any> {
    try {
      const res = await fetch(`${this.API_BASE}/api/goods/ydetail?id=${goodsNo}`);
      const data = await res.json();
      if (data.code === 0) {
        return data.data;
      }
      return null;
    } catch (e) {
      this.logger.error(`Fetch legacy yahoo detail failed: ${e.message}`);
      return null;
    }
  }
}
```

### yahoo.bid.service.ts — 出价逻辑

```typescript
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { YahooBid, YahooBidStatus } from './entities/yahoo-bid.entity';
import { DepositService } from '../deposit/deposit.service';

@Injectable()
export class YahooBidService {
  private readonly logger = new Logger(YahooBidService.name);
  private readonly API_BASE = 'https://app.kangaroo-japan.com';

  constructor(
    @InjectRepository(YahooBid)
    private bidRepository: Repository<YahooBid>,
    private dataSource: DataSource,
    private depositService: DepositService,
  ) {}

  /**
   * 用户竞拍列表
   */
  async list(userId: string, status: number, page: number) {
    const limit = 20;
    const skip = (page - 1) * limit;

    let where: any = { userId };
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
    const goodsNos = items.map(i => i.goodsNo);
    const goodsRepo = this.dataSource.getRepository('YahooGoods');
    const goodsMap = new Map();
    if (goodsNos.length > 0 && goodsRepo) {
      const goodsList = await (goodsRepo as any).find({ where: goodsNos.map(no => ({ goodsNo: no })) });
      for (const g of goodsList) {
        goodsMap.set(g.goodsNo, g);
      }
    }

    const list = items.map(bid => {
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
  async bid(userId: string, goodsNo: string, money: number) {
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
      const data = await res.json();

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
    } catch (e) {
      this.logger.error(`Bid failed: ${e.message}`);
      throw new BadRequestException('出价失败，请稍后重试');
    }
  }

  private getStatusText(status: YahooBidStatus): string {
    switch (status) {
      case YahooBidStatus.BIDDING: return '竞拍中';
      case YahooBidStatus.WON: return '已中标';
      case YahooBidStatus.LOST: return '未中标';
      case YahooBidStatus.CANCELLED: return '已取消';
      default: return '';
    }
  }
}
```

### yahoo.controller.ts — 控制器

```typescript
import {
  Controller, Get, Post, Body, Query, Param, Req,
  UseGuards, HttpCode, HttpStatus, UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { YahooGoodsService } from './yahoo.goods.service';
import { YahooBidService } from './yahoo.bid.service';
import { GoodsListDto } from './dto/goods-list.dto';
import { CreateBidDto } from './dto/create-bid.dto';
import { BidListDto } from './dto/bid-list.dto';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@Controller('api/v1/yahoo')
export class YahooController {
  constructor(
    private goodsService: YahooGoodsService,
    private bidService: YahooBidService,
  ) {}

  @Get('goods')
  @HttpCode(HttpStatus.OK)
  async goodsList(@Query() dto: GoodsListDto) {
    const result = await this.goodsService.list(dto);
    return { code: 0, data: result };
  }

  @Get('goods/:goodsNo')
  @HttpCode(HttpStatus.OK)
  async goodsDetail(
    @Param('goodsNo') goodsNo: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    const detail = await this.goodsService.detail(goodsNo, userId);
    if (!detail) {
      return { code: 1, errmsg: '商品不存在' };
    }
    return { code: 0, data: detail };
  }

  @Post('bid')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async bid(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateBidDto,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const result = await this.bidService.bid(userId, dto.goodsNo, dto.money);
    return result;
  }

  @Get('bids/list')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async bidList(
    @Req() req: AuthenticatedRequest,
    @Query() dto: BidListDto,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const result = await this.bidService.list(userId, dto.status || 0, dto.page || 1);
    return { code: 0, data: result };
  }
}
```

### yahoo.module.ts

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { YahooGoods } from './entities/yahoo-goods.entity';
import { YahooBid } from './entities/yahoo-bid.entity';
import { YahooController } from './yahoo.controller';
import { YahooGoodsService } from './yahoo.goods.service';
import { YahooBidService } from './yahoo.bid.service';
import { DepositModule } from '../deposit/deposit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([YahooGoods, YahooBid]),
    DepositModule,
  ],
  controllers: [YahooController],
  providers: [YahooGoodsService, YahooBidService],
})
export class YahooModule {}
```

## 修改app.module.ts

在 `src/app.module.ts` 中添加：

1. import `YahooGoods` 和 `YahooBid` 实体到 entities 数组
2. import `YahooModule` 到 imports 数组
