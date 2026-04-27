import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VipService } from './vip.service';
import { UserLevel } from './entities/user-level.entity';
import { VipOrder } from './entities/vip-order.entity';
import { User } from '../users/user.entity';

const mockUserLevelRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockVipOrderRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockUserRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
});

describe('VipService', () => {
  let service: VipService;
  let userLevelRepo: ReturnType<typeof mockUserLevelRepo>;
  let vipOrderRepo: ReturnType<typeof mockVipOrderRepo>;
  let userRepo: ReturnType<typeof mockUserRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VipService,
        { provide: getRepositoryToken(UserLevel), useFactory: mockUserLevelRepo },
        { provide: getRepositoryToken(VipOrder), useFactory: mockVipOrderRepo },
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
      ],
    }).compile();

    service = module.get(VipService);
    userLevelRepo = module.get(getRepositoryToken(UserLevel));
    vipOrderRepo = module.get(getRepositoryToken(VipOrder));
    userRepo = module.get(getRepositoryToken(User));
  });

  describe('buyVip', () => {
    const baseUser = { id: 'u1', level: 1, levelEndTime: null, score: 0 } as User;
    const baseLevel = { id: 1, level: 2, name: 'Gold', price: 30, isDeleted: false } as UserLevel;

    it('should throw on invalid level', async () => {
      await expect(service.buyVip('u1', { level: 5, month: 0 })).rejects.toThrow(BadRequestException);
    });

    it('should throw on invalid month', async () => {
      await expect(service.buyVip('u1', { level: 2, month: 5 })).rejects.toThrow(BadRequestException);
    });

    it('should throw if target level not found', async () => {
      userLevelRepo.findOne.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(baseUser);
      await expect(service.buyVip('u1', { level: 2, month: 0 })).rejects.toThrow(NotFoundException);
    });

    it('should throw if trying to downgrade level', async () => {
      userLevelRepo.findOne.mockResolvedValue(baseLevel);
      userRepo.findOne.mockResolvedValue({ ...baseUser, level: 3 });
      await expect(service.buyVip('u1', { level: 2, month: 0 })).rejects.toThrow(BadRequestException);
    });

    it('should create vip order and return order info', async () => {
      userLevelRepo.findOne.mockResolvedValue(baseLevel);
      userRepo.findOne.mockResolvedValue(baseUser);
      const order = {
        id: 'order1',
        outTradeNo: 'VIP_TEST',
        amount: 90,
        offsetAmount: 0,
        level: 2,
        levelName: 'Gold',
        month: 3,
      };
      vipOrderRepo.create.mockReturnValue(order);
      vipOrderRepo.save.mockResolvedValue(order);

      const result = await service.buyVip('u1', { level: 2, month: 0 });
      expect(vipOrderRepo.save).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        level: 2,
        month: 3,
      });
    });
  });

  describe('handlePaymentSuccess', () => {
    it('should do nothing if order not found', async () => {
      vipOrderRepo.findOne.mockResolvedValue(null);
      await service.handlePaymentSuccess('NO_ORDER', 'pay1');
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('should do nothing if already paid', async () => {
      vipOrderRepo.findOne.mockResolvedValue({ outTradeNo: 'VIP1', isPay: true });
      await service.handlePaymentSuccess('VIP1', 'pay1');
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('should update user level on successful payment', async () => {
      const order = {
        id: 'order1',
        outTradeNo: 'VIP1',
        isPay: false,
        userId: 'u1',
        level: 2,
        month: 3,
      };
      vipOrderRepo.findOne.mockResolvedValue(order);
      vipOrderRepo.save.mockResolvedValue({ ...order, isPay: true });
      const user = { id: 'u1', level: 1, levelEndTime: null } as User;
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue({ ...user, level: 2 });

      await service.handlePaymentSuccess('VIP1', 'pay1');

      expect(vipOrderRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isPay: true }));
      expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ level: 2 }));
    });
  });
});
