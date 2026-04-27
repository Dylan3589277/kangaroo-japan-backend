import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DepositService } from './deposit.service';
import { Deposit, DepositStatus, DepositType } from './deposit.entity';
import { User } from '../users/user.entity';
import { Payment } from '../payments/payment.entity';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeQb() {
  const qb = {
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  qb.update.mockReturnValue(qb);
  qb.set.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  return qb;
}

function makeManager(overrides: Record<string, jest.Mock> = {}) {
  return {
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => makeQb()),
    ...overrides,
  };
}

// ── suite ────────────────────────────────────────────────────────────────────

describe('DepositService', () => {
  let module: TestingModule;
  let service: DepositService;

  let depositRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findAndCount: jest.Mock;
    count: jest.Mock;
    findOne: jest.Mock;
  };
  let userRepo: { findOne: jest.Mock };
  let paymentRepo: { create: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    depositRepo = {
      create: jest.fn((data: Record<string, unknown>) => ({ ...data })),
      save: jest.fn(),
      findAndCount: jest.fn(),
      count: jest.fn(),
      findOne: jest.fn(),
    };
    userRepo = { findOne: jest.fn() };
    paymentRepo = { create: jest.fn((data: Record<string, unknown>) => ({ ...data })) };
    dataSource = { transaction: jest.fn() };

    module = await Test.createTestingModule({
      providers: [
        DepositService,
        { provide: getRepositoryToken(Deposit), useValue: depositRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<DepositService>(DepositService);
  });

  afterEach(async () => {
    await module.close();
  });

  // ── createDeposit ──────────────────────────────────────────────────────────

  describe('createDeposit', () => {
    it('creates deposit and payment inside a transaction', async () => {
      const savedDeposit = {
        id: 'dep-uuid',
        orderNo: 'DEPOSIT_1000_ABCDEF',
        amount: 500,
      };
      const savedPayment = { paymentNo: 'PAY_1000_XYZWVU' };
      const manager = makeManager({
        save: jest.fn()
          .mockResolvedValueOnce(savedDeposit)
          .mockResolvedValueOnce(savedPayment),
      });
      dataSource.transaction.mockImplementation((cb: (m: typeof manager) => Promise<unknown>) => cb(manager));

      const result = await service.createDeposit('user-1', 500);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(manager.save).toHaveBeenCalledTimes(2);
      expect(result.depositId).toBe('dep-uuid');
      expect(result.orderNo).toBe('DEPOSIT_1000_ABCDEF');
      expect(result.paymentNo).toMatch(/^PAY_\d+_[A-Z0-9]+$/);
      expect(result.amount).toBe(500);
    });

    it('throws BadRequestException when amount <= 0', async () => {
      await expect(service.createDeposit('user-1', 0)).rejects.toThrow(BadRequestException);
      await expect(service.createDeposit('user-1', -10)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when amount is not integer', async () => {
      await expect(service.createDeposit('user-1', 100.5)).rejects.toThrow(BadRequestException);
    });

    it('generates orderNo with DEPOSIT_ prefix', async () => {
      let capturedOrderNo: string | undefined;
      const manager = makeManager({
        save: jest.fn().mockImplementation((entity: { orderNo?: string }) => {
          if (entity.orderNo) capturedOrderNo = entity.orderNo;
          return Promise.resolve({ id: 'dep-id', orderNo: entity.orderNo, amount: 100 });
        }),
      });
      dataSource.transaction.mockImplementation((cb: (m: typeof manager) => Promise<unknown>) => cb(manager));

      await service.createDeposit('user-1', 100);

      expect(capturedOrderNo).toMatch(/^DEPOSIT_\d+_[A-Z0-9]+$/);
    });
  });

  // ── listDeposits ───────────────────────────────────────────────────────────

  describe('listDeposits', () => {
    it('returns paginated deposit list', async () => {
      const items = [{ id: 'dep-1' }, { id: 'dep-2' }];
      depositRepo.findAndCount.mockResolvedValue([items, 2]);

      const result = await service.listDeposits('user-1', 1, 20);

      expect(result).toEqual({ items, total: 2, page: 1, limit: 20 });
      expect(depositRepo.findAndCount).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('applies correct skip for page 2', async () => {
      depositRepo.findAndCount.mockResolvedValue([[], 0]);
      await service.listDeposits('user-1', 2, 10);
      expect(depositRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  // ── getBalance ─────────────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('returns balance and refunding count', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', depositBalance: '300.00' });
      depositRepo.count.mockResolvedValue(1);

      const result = await service.getBalance('user-1');

      expect(result.balance).toBe(300);
      expect(result.refundingCount).toBe(1);
      expect(result.tipList).toHaveLength(3);
    });

    it('treats null depositBalance as 0', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', depositBalance: null });
      depositRepo.count.mockResolvedValue(0);

      const result = await service.getBalance('user-1');

      expect(result.balance).toBe(0);
    });

    it('throws NotFoundException when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getBalance('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── refundDeposit ──────────────────────────────────────────────────────────

  describe('refundDeposit', () => {
    it('creates REFUNDING record without deducting balance', async () => {
      const user = { id: 'user-1', depositBalance: '500.00' };
      const manager = makeManager({
        findOne: jest.fn()
          .mockResolvedValueOnce(user)   // User lookup
          .mockResolvedValueOnce(null),  // no pending refund
        save: jest.fn().mockResolvedValue({ orderNo: 'REFUND_xxx' }),
      });
      dataSource.transaction.mockImplementation((cb: (m: typeof manager) => Promise<unknown>) => cb(manager));

      const result = await service.refundDeposit('user-1', 200, '13812341234', '张三');

      expect(result.orderNo).toMatch(/^REFUND_/);
      // balance must NOT be modified
      expect(manager.createQueryBuilder).not.toHaveBeenCalled();
      // deposit record created with negative amount and REFUNDING status
      const savedCall = manager.save.mock.calls[0][0] as Partial<Deposit>;
      expect(savedCall.amount).toBe(-200);
      expect(savedCall.status).toBe(DepositStatus.REFUNDING);
      expect(savedCall.type).toBe(DepositType.REFUND);
    });

    it('throws BadRequestException when amount <= 0', async () => {
      await expect(service.refundDeposit('user-1', 0)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when user does not exist', async () => {
      const manager = makeManager({
        findOne: jest.fn().mockResolvedValue(null),
      });
      dataSource.transaction.mockImplementation((cb: (m: typeof manager) => Promise<unknown>) => cb(manager));
      await expect(service.refundDeposit('user-1', 100)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when balance is insufficient', async () => {
      const user = { id: 'user-1', depositBalance: '50.00' };
      const manager = makeManager({
        findOne: jest.fn().mockResolvedValue(user),
      });
      dataSource.transaction.mockImplementation((cb: (m: typeof manager) => Promise<unknown>) => cb(manager));
      await expect(service.refundDeposit('user-1', 100)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when pending refund already exists', async () => {
      const user = { id: 'user-1', depositBalance: '500.00' };
      const existingRefund = { id: 'dep-existing', status: DepositStatus.REFUNDING };
      const manager = makeManager({
        findOne: jest.fn()
          .mockResolvedValueOnce(user)
          .mockResolvedValueOnce(existingRefund),
      });
      dataSource.transaction.mockImplementation((cb: (m: typeof manager) => Promise<unknown>) => cb(manager));
      await expect(service.refundDeposit('user-1', 100)).rejects.toThrow(BadRequestException);
    });
  });
});
