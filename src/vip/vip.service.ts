import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { UserLevel } from './entities/user-level.entity';
import { VipOrder } from './entities/vip-order.entity';
import { BuyVipDto } from './dto/buy-vip.dto';
import { User } from '../users/user.entity';

// 月份选项映射：0=3个月(季), 1=6个月(半年), 2=12个月(年)
const MONTH_OPTIONS: Record<number, number> = {
  0: 3,
  1: 6,
  2: 12,
};

@Injectable()
export class VipService {
  private readonly logger = new Logger(VipService.name);

  constructor(
    @InjectRepository(UserLevel)
    private readonly userLevelRepository: Repository<UserLevel>,
    @InjectRepository(VipOrder)
    private readonly vipOrderRepository: Repository<VipOrder>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * 获取会员等级列表及用户当前等级信息
   */
  async getLevels(userId: string) {
    // 获取当前用户
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 查询所有等级，按 level 升序
    const levels = await this.userLevelRepository.find({
      where: { isDeleted: false },
      order: { level: 'ASC' },
    });

    if (!levels.length) {
      throw new NotFoundException('暂未配置会员等级');
    }

    const userLevel = user.level || 1;
    const userLevelEndTime = user.levelEndTime
      ? Math.floor(user.levelEndTime.getTime() / 1000)
      : 0;
    const now = Math.floor(Date.now() / 1000);
    const isVipValid = user.level > 1 && user.levelEndTime && user.levelEndTime.getTime() > Date.now();

    // 计算每个等级的信息
    const levelList = levels.map((lv) => ({
      ...lv,
      price: Number(lv.price),
      rate: lv.rate ? Number(lv.rate) : null,
      shipRate: lv.shipRate ? Number(lv.shipRate) : null,
      fee: lv.fee ? Number(lv.fee) : null,
      overTimeFee: lv.overTimeFee ? Number(lv.overTimeFee) : null,
      currentLevelStatus: this.getCurrentLevelStatus(lv.level, userLevel, isVipValid),
      offsetAmount: this.calcOffsetAmount(lv, userLevel, isVipValid, userLevelEndTime, now),
    }));

    return {
      userInfo: {
        nickname: user.name,
        avatarUrl: user.avatarUrl,
        level: user.level,
        levelEndTime: user.levelEndTime,
        score: user.score,
        scoreTotal: user.scoreTotal,
      },
      levels: levelList,
      monthOptions: [
        { key: 0, label: '季度', value: 3 },
        { key: 1, label: '半年', value: 6 },
        { key: 2, label: '年度', value: 12 },
      ],
      rules: '会员等级越高，享受的费率折扣、运费优惠和仓储天数越多。升级需补差价。',
    };
  }

  /**
   * 购买VIP会员
   */
  async buyVip(userId: string, dto: BuyVipDto) {
    // 校验等级范围
    if (![2, 3, 4].includes(dto.level)) {
      throw new BadRequestException('无效的会员等级');
    }

    // 校验月份索引
    if (!(dto.month in MONTH_OPTIONS)) {
      throw new BadRequestException('无效的购买时长');
    }

    // 查询目标等级
    const targetLevel = await this.userLevelRepository.findOne({
      where: { level: dto.level, isDeleted: false },
    });
    if (!targetLevel) {
      throw new NotFoundException('目标等级不存在');
    }

    // 获取当前用户
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 不能降级
    if (dto.level <= (user.level || 1)) {
      throw new BadRequestException('只能升级到更高的会员等级');
    }

    const months = MONTH_OPTIONS[dto.month];
    const basePrice = Number(targetLevel.price) * months;

    // 计算升级补差价
    const isVipValid = user.level > 1 && user.levelEndTime && user.levelEndTime.getTime() > Date.now();
    const now = Math.floor(Date.now() / 1000);
    const userLevelEndTime = user.levelEndTime
      ? Math.floor(user.levelEndTime.getTime() / 1000)
      : 0;
    const offsetAmount = this.calcOffsetAmount(targetLevel, user.level || 1, isVipValid, userLevelEndTime, now);

    const totalAmount = basePrice + offsetAmount;

    // 生成外部订单号
    const outTradeNo = this.generateOutTradeNo();

    // 创建 VIP 订单
    const vipOrder = this.vipOrderRepository.create({
      userId,
      level: dto.level,
      levelName: targetLevel.name,
      price: Number(targetLevel.price),
      month: months,
      amount: totalAmount,
      offsetAmount,
      outTradeNo,
      isPay: false,
      levelEndTime: userLevelEndTime,
    });

    await this.vipOrderRepository.save(vipOrder);

    return {
      vipOrderId: vipOrder.id,
      outTradeNo,
      amount: totalAmount,
      offsetAmount,
      basePrice,
      level: dto.level,
      levelName: targetLevel.name,
      month: months,
    };
  }

  /**
   * 支付成功回调：更新用户等级和到期时间
   */
  async handlePaymentSuccess(outTradeNo: string, paymentId: string) {
    const order = await this.vipOrderRepository.findOne({
      where: { outTradeNo },
    });

    if (!order) {
      this.logger.warn(`VIP order not found: ${outTradeNo}`);
      return;
    }

    if (order.isPay) {
      this.logger.log(`VIP order already paid: ${outTradeNo}`);
      return;
    }

    // 更新 VIP 订单
    order.isPay = true;
    order.payTime = new Date();
    order.paymentId = paymentId;
    await this.vipOrderRepository.save(order);

    // 更新用户等级和到期时间
    const user = await this.userRepository.findOne({ where: { id: order.userId } });
    if (!user) {
      this.logger.warn(`User not found for VIP order: ${order.userId}`);
      return;
    }

    const now = Date.now();
    const currentEndTime = user.levelEndTime ? user.levelEndTime.getTime() : now;

    // 如果当前会员已过期或没有，从当前时间开始计算
    // 如果会员仍有效，在原到期时间上续期
    let newEndTime: number;
    if (user.level > 1 && currentEndTime > now) {
      newEndTime = currentEndTime + order.month * 30 * 24 * 60 * 60 * 1000;
    } else {
      newEndTime = now + order.month * 30 * 24 * 60 * 60 * 1000;
    }

    user.level = order.level;
    user.levelEndTime = new Date(newEndTime);
    await this.userRepository.save(user);

    this.logger.log(`VIP upgrade success: userId=${order.userId}, level=${order.level}, endTime=${newEndTime}`);
  }

  /**
   * 判断当前用户等级 vs 目标等级的状态
   */
  private getCurrentLevelStatus(targetLevel: number, userLevel: number, isVipValid: boolean): number {
    if (targetLevel === userLevel && isVipValid) return 1;  // 当前等级
    if (targetLevel < userLevel) return 0;                    // 低于当前等级
    return -1;                                                // 高于当前等级（可升级）
  }

  /**
   * 计算升级补差价
   */
  private calcOffsetAmount(
    targetLevel: UserLevel | null,
    userLevel: number,
    isVipValid: boolean,
    userLevelEndTime: number,
    now: number,
  ): number {
    if (!targetLevel || !isVipValid || targetLevel.level <= userLevel) {
      return 0;
    }
    // 简单按剩余天数比例计算补差价
    // 公式: (targetPrice - currentPrice) / 30 * 剩余天数
    const remainingDays = Math.max(0, Math.ceil((userLevelEndTime - now) / 86400));
    if (remainingDays <= 0) return 0;

    // 获取当前等级价格（默认普通会员价格为0）
    const currentPrice = 0; // 简化处理
    const dailyDiff = (Number(targetLevel.price) - currentPrice) / 30;
    return Math.round(dailyDiff * remainingDays * 100) / 100;
  }

  /**
   * 生成外部订单号
   */
  private generateOutTradeNo(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
    return `VIP${timestamp}${random}`;
  }
}
