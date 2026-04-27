import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ScoreShopService } from './score-shop.service';
import { Coupon } from './entities/coupon.entity';
import { UserCoupon } from './entities/user-coupon.entity';
import { ScoreLog } from './entities/score-log.entity';
import { User } from '../users/user.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

// Build a mock transaction manager that delegates to jest fns
const buildManager = (overrides: Record<string, jest.Mock> = {}) => ({
  findOne: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
  }),
  ...overrides,
});

describe('ScoreShopService', () => {
  let service: ScoreShopService;
  let couponRepo: ReturnType<typeof mockRepo>;
  let userCouponRepo: ReturnType<typeof mockRepo>;
  let scoreLogRepo: ReturnType<typeof mockRepo>;
  let userRepo: ReturnType<typeof mockRepo>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    dataSource = { transaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoreShopService,
        { provide: getRepositoryToken(Coupon), useFactory: mockRepo },
        { provide: getRepositoryToken(UserCoupon), useFactory: mockRepo },
        { provide: getRepositoryToken(ScoreLog), useFactory: mockRepo },
        { provide: getRepositoryToken(User), useFactory: mockRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(ScoreShopService);
    couponRepo = module.get(getRepositoryToken(Coupon));
    userCouponRepo = module.get(getRepositoryToken(UserCoupon));
    scoreLogRepo = module.get(getRepositoryToken(ScoreLog));
    userRepo = module.get(getRepositoryToken(User));
  });

  describe('exchangeCoupon', () => {
    it('should throw NotFoundException if coupon not found', async () => {
      dataSource.transaction.mockImplementation(async (cb) => {
        const manager = buildManager({ findOne: jest.fn().mockResolvedValue(null) });
        return cb(manager);
      });
      await expect(service.exchangeCoupon('u1', 'c1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if stock exhausted', async () => {
      const coupon = { id: 'c1', stock: 5, number: 5, score: 10, name: 'T', isDeleted: false, canbuy: true };
      dataSource.transaction.mockImplementation(async (cb) => {
        const manager = buildManager({ findOne: jest.fn().mockResolvedValueOnce(coupon) });
        return cb(manager);
      });
      await expect(service.exchangeCoupon('u1', 'c1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user has insufficient score', async () => {
      const coupon = { id: 'c1', stock: 0, number: 0, score: 100, name: 'T', isDeleted: false, canbuy: true };
      const user = { id: 'u1', score: 50 } as User;
      const findOneMock = jest.fn()
        .mockResolvedValueOnce(coupon)
        .mockResolvedValueOnce(user);
      dataSource.transaction.mockImplementation(async (cb) => {
        const manager = buildManager({ findOne: findOneMock });
        return cb(manager);
      });
      await expect(service.exchangeCoupon('u1', 'c1')).rejects.toThrow(BadRequestException);
    });

    it('should create user coupon and score log on success', async () => {
      const coupon = {
        id: 'c1', stock: 0, number: 0, score: 10, name: 'Test', isDeleted: false, canbuy: true,
        type: 'cash', orderType: 'ship', icon: '', condition: 0, data: 10, expireDays: 30,
      };
      const user = { id: 'u1', score: 100 } as User;
      const userCoupon = { id: 'uc1' };
      const findOneMock = jest.fn()
        .mockResolvedValueOnce(coupon)
        .mockResolvedValueOnce(user);
      const saveMock = jest.fn().mockResolvedValue(userCoupon);
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      scoreLogRepo.create.mockReturnValue({});
      userCouponRepo.create.mockReturnValue(userCoupon);
      dataSource.transaction.mockImplementation(async (cb) => {
        const manager = {
          findOne: findOneMock,
          save: saveMock,
          createQueryBuilder: jest.fn().mockReturnValue(qb),
        };
        return cb(manager);
      });
      const result = await service.exchangeCoupon('u1', 'c1');
      expect(saveMock).toHaveBeenCalledTimes(2); // scoreLog + userCoupon
      expect(result).toHaveProperty('userCoupon');
    });
  });

  describe('getCoupon', () => {
    it('should throw if user not found', async () => {
      const findOneMock = jest.fn().mockResolvedValue(null);
      dataSource.transaction.mockImplementation(async (cb) => {
        const manager = buildManager({ findOne: findOneMock });
        return cb(manager);
      });
      await expect(service.getCoupon('u1', 'c1', 'free')).rejects.toThrow(NotFoundException);
    });

    it('should throw if coupon not found', async () => {
      const user = { id: 'u1', score: 0 } as User;
      const findOneMock = jest.fn()
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(null);
      dataSource.transaction.mockImplementation(async (cb) => {
        const manager = buildManager({ findOne: findOneMock });
        return cb(manager);
      });
      await expect(service.getCoupon('u1', 'c1', 'free')).rejects.toThrow(NotFoundException);
    });

    it('should throw if stock exhausted', async () => {
      const user = { id: 'u1', score: 0 } as User;
      const coupon = { id: 'c1', stock: 3, number: 3, isDeleted: false, canbuy: true };
      const findOneMock = jest.fn()
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(coupon);
      dataSource.transaction.mockImplementation(async (cb) => {
        const manager = buildManager({ findOne: findOneMock });
        return cb(manager);
      });
      await expect(service.getCoupon('u1', 'c1', 'free')).rejects.toThrow(BadRequestException);
    });

    it('should throw if user already holds this coupon unused', async () => {
      const user = { id: 'u1', score: 0 } as User;
      const coupon = { id: 'c1', stock: 0, number: 0, isDeleted: false, canbuy: true, expireDays: 7 };
      const existingUserCoupon = { id: 'uc1', userId: 'u1', couponId: 'c1', isUsed: false };
      const findOneMock = jest.fn()
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(coupon)
        .mockResolvedValueOnce(existingUserCoupon);
      dataSource.transaction.mockImplementation(async (cb) => {
        const manager = buildManager({ findOne: findOneMock });
        return cb(manager);
      });
      await expect(service.getCoupon('u1', 'c1', 'free')).rejects.toThrow(BadRequestException);
    });

    it('should create free user coupon on success', async () => {
      const user = { id: 'u1', score: 0 } as User;
      const coupon = {
        id: 'c1', stock: 0, number: 0, isDeleted: false, canbuy: true,
        type: 'cash', orderType: null, name: 'Test', icon: '', condition: 0, data: 5, expireDays: 0,
      };
      const findOneMock = jest.fn()
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(coupon)
        .mockResolvedValueOnce(null); // no existing coupon
      const userCoupon = { id: 'uc1' };
      const saveMock = jest.fn().mockResolvedValue(userCoupon);
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      userCouponRepo.create.mockReturnValue(userCoupon);
      dataSource.transaction.mockImplementation(async (cb) => {
        const manager = {
          findOne: findOneMock,
          save: saveMock,
          createQueryBuilder: jest.fn().mockReturnValue(qb),
        };
        return cb(manager);
      });
      const result = await service.getCoupon('u1', 'c1', 'free');
      expect(saveMock).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty('userCoupon');
    });
  });
});
