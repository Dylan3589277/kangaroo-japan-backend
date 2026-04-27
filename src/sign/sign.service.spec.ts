import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SignService } from './sign.service';
import { SignLog } from './sign-log.entity';
import { User } from '../users/user.entity';
import { ScoreLog } from '../score-shop/entities/score-log.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const buildManager = (overrides: Partial<Record<string, jest.Mock>> = {}) => ({
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

describe('SignService', () => {
  let service: SignService;
  let signLogRepo: ReturnType<typeof mockRepo>;
  let userRepo: ReturnType<typeof mockRepo>;
  let scoreLogRepo: ReturnType<typeof mockRepo>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    dataSource = { transaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignService,
        { provide: getRepositoryToken(SignLog), useFactory: mockRepo },
        { provide: getRepositoryToken(User), useFactory: mockRepo },
        { provide: getRepositoryToken(ScoreLog), useFactory: mockRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(SignService);
    signLogRepo = module.get(getRepositoryToken(SignLog));
    userRepo = module.get(getRepositoryToken(User));
    scoreLogRepo = module.get(getRepositoryToken(ScoreLog));
  });

  describe('doSign', () => {
    it('should return code=1 when user has already signed in today', async () => {
      const existingLog = { id: 'log1', userId: 'u1', dayIndex: 1, score: 5 } as SignLog;
      signLogRepo.findOne.mockResolvedValue(existingLog);

      const result = await service.doSign('u1');

      expect(result).toEqual({ code: 1, errmsg: '您今天已经签过到了' });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('should create sign log and score log on first check-in of the day', async () => {
      // today: no existing sign; yesterday: no log → dayIndex=1, score=5
      signLogRepo.findOne
        .mockResolvedValueOnce(null)  // today check
        .mockResolvedValueOnce(null); // yesterday check

      const user = { id: 'u1', score: 100 } as User;
      const signLogCreated = { id: 'sl1', userId: 'u1', dayIndex: 1, score: 5 } as SignLog;
      const scoreLogCreated = { id: 'scl1', userId: 'u1', amount: 5, type: 'sign' } as unknown as ScoreLog;

      signLogRepo.create.mockReturnValue(signLogCreated);
      scoreLogRepo.create.mockReturnValue(scoreLogCreated);

      const saveMock = jest.fn().mockImplementation((entity) => Promise.resolve(entity));
      const manager = buildManager({
        findOne: jest.fn().mockResolvedValue(user),
        save: saveMock,
      });

      dataSource.transaction.mockImplementation(async (cb: (m: typeof manager) => Promise<void>) => cb(manager));

      const result = await service.doSign('u1');

      expect(result).toEqual({ code: 0, errmsg: '签到成功，获得5积分' });
      // Two saves inside transaction: sign log + score log
      expect(saveMock).toHaveBeenCalledTimes(2);
      expect(saveMock).toHaveBeenCalledWith(signLogCreated);
      expect(saveMock).toHaveBeenCalledWith(scoreLogCreated);
    });

    it('should write score log with correct before/after scores', async () => {
      signLogRepo.findOne
        .mockResolvedValueOnce(null)  // today check
        .mockResolvedValueOnce(null); // yesterday check → dayIndex=1, score=5

      const user = { id: 'u1', score: 200 } as User;
      const signLogCreated = { id: 'sl1' } as SignLog;
      const capturedScoreLog: Record<string, unknown>[] = [];

      signLogRepo.create.mockReturnValue(signLogCreated);
      scoreLogRepo.create.mockImplementation((data) => {
        capturedScoreLog.push(data as Record<string, unknown>);
        return data as ScoreLog;
      });

      const saveMock = jest.fn().mockImplementation((entity) => Promise.resolve(entity));
      const manager = buildManager({
        findOne: jest.fn().mockResolvedValue(user),
        save: saveMock,
      });
      dataSource.transaction.mockImplementation(async (cb: (m: typeof manager) => Promise<void>) => cb(manager));

      await service.doSign('u1');

      expect(capturedScoreLog).toHaveLength(1);
      expect(capturedScoreLog[0]).toMatchObject({
        userId: 'u1',
        amount: 5,
        type: 'sign',
        beforeScore: 200,
        afterScore: 205,
      });
    });

    it('should increment dayIndex when user signed in yesterday (consecutive days)', async () => {
      const yesterdayLog = { id: 'yl1', dayIndex: 3, score: 15 } as SignLog;
      signLogRepo.findOne
        .mockResolvedValueOnce(null)         // today: not signed
        .mockResolvedValueOnce(yesterdayLog); // yesterday: day 3 → today is day 4, score=15

      const user = { id: 'u1', score: 50 } as User;
      signLogRepo.create.mockReturnValue({} as SignLog);
      scoreLogRepo.create.mockReturnValue({} as ScoreLog);

      const saveMock = jest.fn().mockImplementation((e) => Promise.resolve(e));
      const manager = buildManager({
        findOne: jest.fn().mockResolvedValue(user),
        save: saveMock,
      });
      dataSource.transaction.mockImplementation(async (cb: (m: typeof manager) => Promise<void>) => cb(manager));

      const result = await service.doSign('u1');

      // day 4 score = SCORE_RULES[3] = 15
      expect(result).toEqual({ code: 0, errmsg: '签到成功，获得15积分' });
      expect(signLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ dayIndex: 4, score: 15 }),
      );
    });
  });
});
