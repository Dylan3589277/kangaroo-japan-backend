import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Coupon } from './entities/coupon.entity';
import { UserCoupon } from './entities/user-coupon.entity';
import { ScoreLog } from './entities/score-log.entity';
import { User } from '../users/user.entity';

@Injectable()
export class ScoreShopService {
  private readonly logger = new Logger(ScoreShopService.name);

  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    @InjectRepository(UserCoupon)
    private readonly userCouponRepository: Repository<UserCoupon>,
    @InjectRepository(ScoreLog)
    private readonly scoreLogRepository: Repository<ScoreLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 生成优惠券兑换码
   */
  private generateCouponCode(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
    return `CPN${timestamp}${random}`;
  }

  /**
   * POST /api/v1/score/shop/goods — 积分商品列表
   */
  async listGoods(
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ list: Coupon[]; total: number }> {
    const [list, total] = await this.couponRepository.findAndCount({
      where: { isDeleted: false, canbuy: true },
      order: { score: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { list, total };
  }

  /**
   * POST /api/v1/score/shop/buy — 积分兑换商品
   */
  async exchangeCoupon(userId: string, couponId: string): Promise<{ userCoupon: UserCoupon }> {
    return await this.dataSource.transaction(async (manager) => {
      // 查找优惠券定义
      const coupon = await manager.findOne(Coupon, {
        where: { id: couponId, isDeleted: false, canbuy: true },
      });
      if (!coupon) {
        throw new NotFoundException('优惠券不存在或已下架');
      }

      // 检查库存
      if (coupon.stock > 0 && coupon.number >= coupon.stock) {
        throw new BadRequestException('优惠券库存不足');
      }

      // 查找用户（悲观锁）
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) {
        throw new NotFoundException('用户不存在');
      }

      const currentScore = user.score || 0;
      const requiredScore = coupon.score;

      // 检查积分是否足够
      if (currentScore < requiredScore) {
        throw new BadRequestException(`积分不足，需要 ${requiredScore} 积分`);
      }

      // 扣减用户积分
      await manager
        .createQueryBuilder()
        .update(User)
        .set({ score: () => `score - ${requiredScore}` })
        .where('id = :id', { id: userId })
        .execute();

      // 增加优惠券已发放数量
      await manager
        .createQueryBuilder()
        .update(Coupon)
        .set({ number: () => `number + 1` })
        .where('id = :id', { id: couponId })
        .execute();

      // 创建积分变动记录
      const scoreLog = this.scoreLogRepository.create({
        userId,
        amount: -requiredScore,
        type: 'exchange',
        remark: `兑换优惠券: ${coupon.name}`,
        beforeScore: currentScore,
        afterScore: currentScore - requiredScore,
      });
      await manager.save(scoreLog);

      // 计算过期时间
      const expire = coupon.expireDays > 0
        ? new Date(Date.now() + coupon.expireDays * 24 * 60 * 60 * 1000)
        : null;

      // 创建用户优惠券记录
      const userCoupon = this.userCouponRepository.create({
        userId,
        couponId: coupon.id,
        code: this.generateCouponCode(),
        type: coupon.type,
        orderType: coupon.orderType,
        name: coupon.name,
        icon: coupon.icon,
        condition: Number(coupon.condition),
        data: Number(coupon.data),
        expire,
        source: 'exchange',
      });
      await manager.save(userCoupon);

      return { userCoupon };
    });
  }

  /**
   * POST /api/v1/score/shop/getcoupon — 领取优惠券
   */
  async getCoupon(userId: string, couponId: string, type: string): Promise<{ userCoupon: UserCoupon }> {
    return await this.dataSource.transaction(async (manager) => {
      // 查找优惠券定义
      const coupon = await manager.findOne(Coupon, {
        where: { id: couponId, isDeleted: false, canbuy: true },
      });
      if (!coupon) {
        throw new NotFoundException('优惠券不存在或已下架');
      }

      // 检查库存
      if (coupon.stock > 0 && coupon.number >= coupon.stock) {
        throw new BadRequestException('优惠券库存不足');
      }

      // 频率限制：检查是否已领取过同类型优惠券
      const existingCoupon = await manager.findOne(UserCoupon, {
        where: {
          userId,
          couponId,
          isUsed: false,
        },
      });
      if (existingCoupon) {
        throw new BadRequestException('您已领取过该优惠券，请先使用');
      }

      // 增加优惠券已发放数量
      await manager
        .createQueryBuilder()
        .update(Coupon)
        .set({ number: () => `number + 1` })
        .where('id = :id', { id: couponId })
        .execute();

      // 计算过期时间
      const expire = coupon.expireDays > 0
        ? new Date(Date.now() + coupon.expireDays * 24 * 60 * 60 * 1000)
        : null;

      // 创建用户优惠券记录（免费领取，不扣积分）
      const userCoupon = this.userCouponRepository.create({
        userId,
        couponId: coupon.id,
        code: this.generateCouponCode(),
        type: coupon.type,
        orderType: coupon.orderType,
        name: coupon.name,
        icon: coupon.icon,
        condition: Number(coupon.condition),
        data: Number(coupon.data),
        expire,
        source: 'free',
      });
      await manager.save(userCoupon);

      return { userCoupon };
    });
  }
}
