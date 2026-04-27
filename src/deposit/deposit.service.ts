import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Deposit, DepositStatus, DepositType } from './deposit.entity';
import { User } from '../users/user.entity';
import { Payment, PaymentStatus, PaymentMethod, PaymentProvider, Currency } from '../payments/payment.entity';

@Injectable()
export class DepositService {
  private readonly logger = new Logger(DepositService.name);

  constructor(
    @InjectRepository(Deposit)
    private readonly depositRepository: Repository<Deposit>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 生成幂等押金订单号：DEPOSIT_ + 时间戳 + 随机6位
   */
  private generateOrderNo(): string {
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `DEPOSIT_${ts}_${rand}`;
  }

  /**
   * 生成支付流水号
   */
  private generatePaymentNo(): string {
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `PAY_${ts}_${rand}`;
  }

  /**
   * 创建押金充值订单（在事务中同时创建 deposit + payment 记录）
   */
  async createDeposit(
    userId: string,
    amount: number,
  ): Promise<{
    depositId: string;
    orderNo: string;
    paymentNo: string;
    amount: number;
  }> {
    if (amount <= 0) {
      throw new BadRequestException('金额必须大于0');
    }

    if (!Number.isInteger(amount)) {
      throw new BadRequestException('只能充值整数金额');
    }

    const orderNo = this.generateOrderNo();
    const paymentNo = this.generatePaymentNo();

    return await this.dataSource.transaction(async (manager) => {
      const deposit = this.depositRepository.create({
        userId,
        amount,
        status: DepositStatus.PENDING,
        type: DepositType.RECHARGE,
        orderNo,
        remark: '竞拍押金支付',
      });
      const savedDeposit = await manager.save(deposit);

      const payment = this.paymentRepository.create({
        paymentNo,
        orderId: savedDeposit.id,
        userId,
        amount,
        currency: Currency.CNY,
        method: PaymentMethod.ALIPAY,
        provider: PaymentProvider.PINGXX,
        status: PaymentStatus.PENDING,
        expiredAt: new Date(Date.now() + 30 * 60 * 1000),
      });
      await manager.save(payment);

      return {
        depositId: savedDeposit.id,
        orderNo: savedDeposit.orderNo,
        paymentNo: payment.paymentNo,
        amount: Number(savedDeposit.amount),
      };
    });
  }

  /**
   * 押金记录列表
   */
  async listDeposits(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    items: Deposit[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [items, total] = await this.depositRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  /**
   * 押金余额查询
   */
  async getBalance(userId: string): Promise<{
    balance: number;
    refundingCount: number;
    tipList: string[];
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const refundingCount = await this.depositRepository.count({
      where: {
        userId,
        status: DepositStatus.REFUNDING,
      },
    });

    return {
      balance: Number(user.depositBalance || 0),
      refundingCount,
      tipList: [
        '1、弃标会扣除押金或保证金。',
        '2、竞标金额最高可以竞标保证金x100 的价格的商品。',
        '3、若充值100人民币可最高出价至10000日元，多个出价商品共享额度。',
      ],
    };
  }

  /**
   * 押金退款申请
   * 只创建退款申请记录（status = REFUNDING），不直接扣减余额。
   * 实际余额扣减由管理员审批后执行。
   */
  async refundDeposit(
    userId: string,
    amount: number,
    alipayNo?: string,
    alipayRealname?: string,
  ): Promise<{ orderNo: string }> {
    if (amount <= 0) {
      throw new BadRequestException('请输入退款金额');
    }

    return await this.dataSource.transaction(async (manager) => {
      // 在事务内加锁检查，防止并发双重提交
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) {
        throw new NotFoundException('用户不存在');
      }

      const balance = Number(user.depositBalance || 0);
      if (balance < amount) {
        throw new BadRequestException('你的押金不足');
      }

      // 检查是否有未处理的退款申请
      const pendingRefund = await manager.findOne(Deposit, {
        where: {
          userId,
          status: DepositStatus.REFUNDING,
        },
      });
      if (pendingRefund) {
        throw new BadRequestException('你还有未处理的申请');
      }

      // 仅创建退款申请记录，余额待管理员审批后扣除
      const orderNo = `REFUND_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const deposit = this.depositRepository.create({
        userId,
        amount: -amount,
        status: DepositStatus.REFUNDING,
        type: DepositType.REFUND,
        orderNo,
        remark: `押金退款申请 - 支付宝: ${alipayNo || ''}${alipayRealname ? ' / ' + alipayRealname : ''}`,
        refundReason: '用户申请退款',
      });
      await manager.save(deposit);

      return { orderNo };
    });
  }

  /**
   * 处理押金支付成功回调（供支付模块调用）
   */
  async handleDepositPaymentSuccess(orderNo: string, paymentId: string): Promise<void> {
    const deposit = await this.depositRepository.findOne({
      where: { orderNo },
    });
    if (!deposit) {
      this.logger.warn(`Deposit not found for orderNo: ${orderNo}`);
      return;
    }

    if (deposit.status !== DepositStatus.PENDING) {
      this.logger.log(`Deposit ${orderNo} already processed (status: ${deposit.status})`);
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      deposit.status = DepositStatus.SUCCEEDED;
      deposit.paymentId = paymentId;
      await manager.save(deposit);

      await manager
        .createQueryBuilder()
        .update(User)
        .set({ depositBalance: () => `deposit_balance + ${deposit.amount}` })
        .where('id = :id', { id: deposit.userId })
        .execute();
    });
  }

  /**
   * 扣减押金（用于竞标等场景）
   */
  async deductDeposit(userId: string, amount: number, remark: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) {
        throw new NotFoundException('用户不存在');
      }

      const balance = Number(user.depositBalance || 0);
      if (balance < amount) {
        throw new BadRequestException('押金不足');
      }

      const orderNo = `DEDUCT_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const deposit = this.depositRepository.create({
        userId,
        amount: -amount,
        status: DepositStatus.SUCCEEDED,
        type: DepositType.DEDUCT,
        orderNo,
        remark,
      });
      await manager.save(deposit);

      await manager
        .createQueryBuilder()
        .update(User)
        .set({ depositBalance: () => `deposit_balance - ${amount}` })
        .where('id = :id', { id: userId })
        .execute();
    });
  }
}
