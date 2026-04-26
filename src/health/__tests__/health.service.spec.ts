import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { HealthService } from '../health.service';
import { HEALTH_REDIS_CLIENT } from '../health.constants';

describe('HealthService', () => {
  let module: TestingModule;
  let service: HealthService;
  let mockDataSource: { query: jest.Mock };
  let mockRedis: { ping: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();
    mockDataSource = { query: jest.fn() };
    mockRedis = { ping: jest.fn() };

    module = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: HEALTH_REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  afterEach(async () => {
    jest.useRealTimers();
    await module.close();
  });

  it('returns ok when both services are up', async () => {
    mockDataSource.query.mockResolvedValue([]);
    mockRedis.ping.mockResolvedValue('PONG');

    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.services.database.status).toBe('up');
    expect(result.services.redis.status).toBe('up');
    expect(typeof result.services.database.latencyMs).toBe('number');
    expect(typeof result.services.redis.latencyMs).toBe('number');
  });

  it('returns error when database is down', async () => {
    mockDataSource.query.mockRejectedValue(new Error('Connection refused'));
    mockRedis.ping.mockResolvedValue('PONG');

    const result = await service.check();

    expect(result.status).toBe('error');
    expect(result.services.database.status).toBe('down');
    expect(result.services.database.error).toBe('Connection refused');
    expect(result.services.redis.status).toBe('up');
  });

  it('returns error when redis is down', async () => {
    mockDataSource.query.mockResolvedValue([]);
    mockRedis.ping.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await service.check();

    expect(result.status).toBe('error');
    expect(result.services.database.status).toBe('up');
    expect(result.services.redis.status).toBe('down');
    expect(result.services.redis.error).toBe('ECONNREFUSED');
  });

  it('returns error when both services are down', async () => {
    mockDataSource.query.mockRejectedValue(new Error('DB down'));
    mockRedis.ping.mockRejectedValue(new Error('Redis down'));

    const result = await service.check();

    expect(result.status).toBe('error');
    expect(result.services.database.status).toBe('down');
    expect(result.services.redis.status).toBe('down');
  });

  it('includes required top-level fields', async () => {
    mockDataSource.query.mockResolvedValue([]);
    mockRedis.ping.mockResolvedValue('PONG');

    const result = await service.check();

    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.version).toBeDefined();
    expect(typeof result.uptime).toBe('number');
  });
});
