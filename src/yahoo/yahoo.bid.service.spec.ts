import { Test, TestingModule } from '@nestjs/testing';
import { Repository, DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { YahooBidService, YAHOO_BID_PROVIDER } from './yahoo.bid.service';
import { YahooBid, YahooBidStatus } from './entities/yahoo-bid.entity';
import { YahooGoods, YahooGoodsStatus } from './entities/yahoo-goods.entity';

const mockBidProvider = {
  placeBid: jest.fn().mockResolvedValue({ code: 0, errmsg: '出价成功' }),
};

describe('YahooBidService', () => {
  let service: YahooBidService;
  let bidRepo: Record<string, jest.Mock>;
  let goodsRepo: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    bidRepo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };
    goodsRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn((cb: (m: Record<string, unknown>) => Promise<unknown>) => {
        const mockManager = {
          findOne: jest.fn(),
          save: jest.fn(),
          create: jest.fn((_entity, data) => data),
          find: jest.fn(),
        };
        return cb(mockManager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YahooBidService,
        { provide: getRepositoryToken(YahooBid), useValue: bidRepo },
        { provide: getRepositoryToken(YahooGoods), useValue: goodsRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: YAHOO_BID_PROVIDER, useValue: mockBidProvider },
      ],
    }).compile();

    service = module.get<YahooBidService>(YahooBidService);
  });

  describe('list', () => {
    it('should return paginated bid list', async () => {
      bidRepo.findAndCount.mockResolvedValue([
        [
          {
            id: '1',
            goodsNo: 'g001',
            price: 1000,
            status: YahooBidStatus.BIDDING,
            createdAt: new Date(),
          },
        ],
        1,
      ]);
      goodsRepo.find.mockResolvedValue([
        { goodsNo: 'g001', goodsName: 'Test Item', cover: 'img.jpg' },
      ]);

      const result = await service.list('user1', 0, 1);
      expect(result.list).toHaveLength(1);
      expect(result.list[0].goods_name).toBe('Test Item');
      expect(result.list[0].status_txt).toBe('竞拍中');
      expect(result.totalPages).toBe(1);
    });

    it('should return empty list when no bids', async () => {
      bidRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.list('user1', 0, 1);
      expect(result.list).toHaveLength(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('bid', () => {
    it('should reject zero or negative money', async () => {
      await expect(service.bid('user1', 'g001', 0)).rejects.toThrow(BadRequestException);
      await expect(service.bid('user1', 'g001', -100)).rejects.toThrow(BadRequestException);
    });

    it('should reject if goods does not exist', async () => {
      dataSource.transaction = jest.fn(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(null),
          save: jest.fn(),
          create: jest.fn((_entity, data) => data),
          find: jest.fn(),
        };
        return cb(mockManager);
      });

      await expect(service.bid('user1', 'nonexist', 2000)).rejects.toThrow(BadRequestException);
    });

    it('should reject if goods is not active', async () => {
      dataSource.transaction = jest.fn(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue({
            goodsNo: 'g001',
            status: YahooGoodsStatus.ENDED,
            bidPrice: 1000,
            price: 500,
            leftTimestamp: 0,
            bidNum: 0,
          }),
          save: jest.fn(),
          create: jest.fn((_entity, data) => data),
          find: jest.fn(),
        };
        return cb(mockManager);
      });

      await expect(service.bid('user1', 'g001', 2000)).rejects.toThrow(BadRequestException);
    });

    it('should reject if bid is lower than min increment', async () => {
      dataSource.transaction = jest.fn(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue({
            goodsNo: 'g001',
            status: YahooGoodsStatus.ACTIVE,
            bidPrice: 1000,
            price: 500,
            leftTimestamp: 3600,
            bidNum: 0,
          }),
          save: jest.fn(),
          create: jest.fn((_entity, data) => data),
          find: jest.fn(),
        };
        return cb(mockManager);
      });

      await expect(service.bid('user1', 'g001', 1000)).rejects.toThrow(BadRequestException);
    });

    it('should place a valid bid successfully', async () => {
      const mockSave = jest.fn();
      const mockCreate = jest.fn((_entity, data) => data);

      dataSource.transaction = jest.fn(async (cb) => {
        const mockManager = {
          findOne: jest
            .fn()
            .mockResolvedValueOnce({
              goodsNo: 'g001',
              status: YahooGoodsStatus.ACTIVE,
              bidPrice: 1000,
              price: 500,
              leftTimestamp: 3600,
              bidNum: 2,
            })
            .mockResolvedValueOnce(null), // no existing bid
          save: mockSave,
          create: mockCreate,
          find: jest.fn(),
        };
        return cb(mockManager);
      });

      const result = await service.bid('user1', 'g001', 1500);
      expect(result.code).toBe(0);
      expect(mockBidProvider.placeBid).toHaveBeenCalledWith('g001', 1500);
    });
  });
});
