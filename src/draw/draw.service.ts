import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DrawActivity } from './entities/draw-activity.entity';
import { DrawPrize, DrawPrizeType } from './entities/draw-prize.entity';
import { DrawLog } from './entities/draw-log.entity';
import { User } from '../users/user.entity';
import { ScoreLog } from '../score-shop/entities/score-log.entity';
import { Coupon } from '../score-shop/entities/coupon.entity';
import { UserCoupon } from '../score-shop/entities/user-coupon.entity';

@Injectable()
export class DrawService {
  private readonly logger = new Logger(DrawService.name);

  constructor(
    @InjectRepository(DrawActivity)
    private activityRepository: Repository<DrawActivity>,
    @InjectRepository(DrawPrize)
    private prizeRepository: Repository<DrawPrize>,
    @InjectRepository(DrawLog)
    private logRepository: Repository<DrawLog>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ScoreLog)
    private scoreLogRepository: Repository<ScoreLog>,
    @InjectRepository(Coupon)
    private couponRepository: Repository<Coupon>,
    @InjectRepository(UserCoupon)
    private userCouponRepository: Repository<UserCoupon>,
    private dataSource: DataSource,
  ) {}

  /**
   * 获取抽奖首页配置
   */
  async getIndex(): Promise<{
    activity: DrawActivity | null;
    prizes: DrawPrize[];
    userScore: number;
  }> {
    const activity = await this.activityRepository.findOne({
      where: { status: 1 },
      order: { createdAt: 'DESC' },
    });

    const prizes = await this.prizeRepository.find({
      where: { isDeleted: 0 },
      order: { rate: 'ASC' },
    });

    return { activity, prizes, userScore: 0 };
  }

  /**
   * 执行抽奖
   */
  async draw(userId: string): Promise<{
    prizeId: string;
    type: DrawPrizeType;
    name: string;
    cover: string | null;
  }> {
    return await this.dataSource.transaction(async (manager) => {
      // 1. 获取活动
      const activity = await manager.findOne(DrawActivity, {
        where: { status: 1 },
        order: { createdAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });

      if (!activity) {
        throw new BadRequestException('暂无抽奖活动');
      }

      // 2. 校验活动日期
      if (activity.runType === 'year') {
        const today = new Date().toISOString().slice(0, 10);
        if (today !== activity.rundate) {
          throw new BadRequestException('抽奖未开放');
        }
      } else if (activity.runType === 'month') {
        const day = String(new Date().getDate());
        const days = activity.rundate.split(',');
        if (!days.includes(day)) {
          throw new BadRequestException('抽奖未开放');
        }
      } else if (activity.runType === 'week') {
        let week = String(new Date().getDay());
        if (week === '0') week = '7';
        const weeks = activity.rundate.split(',');
        if (!weeks.includes(week)) {
          throw new BadRequestException('抽奖未开放');
        }
      }

      // 3. 锁定用户积分
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new BadRequestException('用户不存在');
      }

      const userScore = Number(user.score || 0);
      if (userScore < activity.price) {
        throw new BadRequestException('剩余积分不足');
      }

      // 4. 获取奖品列表
      const prizes = await manager.find(DrawPrize, {
        where: { isDeleted: 0 },
        order: { rate: 'ASC' },
      });

      if (prizes.length === 0) {
        throw new BadRequestException('暂无奖品配置');
      }

      // 5. 检查总库存，不足则重置
      const totalLeft = prizes.reduce((s, p) => s + p.leftNumber, 0);
      if (totalLeft <= 0) {
        // 重置库存
        for (const prize of prizes) {
          prize.leftNumber = prize.number;
          prize.sales = 0;
          await manager.save(prize);
        }
      }

      // 6. 重新检查库存
      const refreshedPrizes = await manager.find(DrawPrize, {
        where: { isDeleted: 0 },
        order: { rate: 'ASC' },
      });

      const freshTotalLeft = refreshedPrizes.reduce((s, p) => s + p.leftNumber, 0);
      if (freshTotalLeft <= 0) {
        throw new BadRequestException('库存不足');
      }

      // 7. 概率抽奖（抽奖箱算法）
      const drawBox: number[] = [];
      for (let i = 0; i < refreshedPrizes.length; i++) {
        const prize = refreshedPrizes[i];
        if (prize.leftNumber <= 0) continue;
        drawBox.push(...Array(prize.leftNumber).fill(i));
      }

      if (drawBox.length === 0) {
        throw new BadRequestException('库存不足');
      }

      const randomIndex = Math.floor(Math.random() * drawBox.length);
      const wonPrize = refreshedPrizes[drawBox[randomIndex]];

      // 8. 扣积分
      const beforeScore = userScore;
      const afterScore = beforeScore - activity.price;
      await manager.update(User, { id: userId }, { score: afterScore });

      // 9. 写积分流水
      const scoreLog = manager.create(ScoreLog, {
        userId,
        amount: -activity.price,
        type: 'draw',
        remark: `抽奖扣除(${activity.name})`,
        beforeScore,
        afterScore,
      });
      await manager.save(scoreLog);

      // 10. 扣减奖品库存
      wonPrize.leftNumber -= 1;
      wonPrize.sales += 1;
      await manager.save(wonPrize);

      // 11. 发放奖品
      if (wonPrize.type === DrawPrizeType.COUPON) {
        // 查找优惠券定义并发放
        const coupon = await manager.findOne(Coupon, {
          where: { id: wonPrize.prize },
        });
        if (coupon) {
          const userCoupon = manager.create(UserCoupon, {
            userId,
            couponId: coupon.id,
            couponName: coupon.name ?? coupon.type,
            couponType: coupon.type,
            type: coupon.type,
            condition: coupon.condition ?? '',
            data: coupon.data ?? '',
            isUsed: false,
            expireDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天有效期
          });
          await manager.save(userCoupon);
        }
      } else if (wonPrize.type === DrawPrizeType.SCORE) {
        const rewardScore = Number(wonPrize.prize) || 0;
        if (rewardScore > 0) {
          const newScore = afterScore + rewardScore;
          await manager.update(User, { id: userId }, { score: newScore });

          const rewardLog = manager.create(ScoreLog, {
            userId,
            amount: rewardScore,
            type: 'draw',
            remark: `抽奖奖励(${wonPrize.name})`,
            beforeScore: afterScore,
            afterScore: newScore,
          });
          await manager.save(rewardLog);
        }
      }

      // 12. 写抽奖记录
      const log = manager.create(DrawLog, {
        userId,
        activityId: activity.id,
        activityName: activity.name,
        price: activity.price,
        prize: wonPrize.prize,
        type: wonPrize.type,
        name: wonPrize.name,
        cover: wonPrize.cover,
      });
      await manager.save(log);

      return {
        prizeId: wonPrize.id,
        type: wonPrize.type,
        name: wonPrize.name,
        cover: wonPrize.cover,
      };
    });
  }

  /**
   * 抽奖记录
   */
  async getLogs(userId: string, page: number): Promise<{ list: DrawLog[]; total: number }> {
    const limit = 20;
    const skip = (page - 1) * limit;

    const [list, total] = await this.logRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { list, total };
  }
}
