import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThanOrEqual } from 'typeorm';
import { SignLog } from './sign-log.entity';
import { User } from '../users/user.entity';

@Injectable()
export class SignService {
  // 签到积分规则（连续7天）
  private readonly SCORE_RULES = [5, 10, 15, 15, 15, 15, 25];

  constructor(
    @InjectRepository(SignLog)
    private signLogRepository: Repository<SignLog>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
  ) {}

  async getSignInfo(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('用户不存在');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 获取最近7天的签到记录
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    const logs = await this.signLogRepository.find({
      where: {
        userId,
        signDate: LessThanOrEqual(today) as unknown as Date,
      },
      order: { signDate: 'ASC' },
    });

    // 只取近7天的记录
    const recentLogs = logs.filter((l) => l.signDate >= weekAgo);

    // 构建7天列表
    const signDays = this.SCORE_RULES.map((score, index) => {
      const day = index + 1;
      const log = recentLogs.find((l) => l.dayIndex === day);
      return { index: day, score, signed: !!log };
    });

    // 检查今天是否已签到
    const todayLog = await this.signLogRepository.findOne({
      where: { userId, signDate: today },
    });

    return {
      myscore: Number(user.score || 0),
      signDays,
      coupons: [],
      todaySigned: !!todayLog,
      todayScore: todayLog ? todayLog.score : 0,
    };
  }

  async doSign(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.signLogRepository.findOne({
      where: { userId, signDate: today },
    });
    if (existing) {
      return { code: 1, errmsg: '您今天已经签过到了' };
    }

    // 计算是连续第几天
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayLog = await this.signLogRepository.findOne({
      where: { userId, signDate: yesterday },
    });

    let dayIndex = 1;
    if (yesterdayLog) {
      dayIndex = yesterdayLog.dayIndex >= 7 ? 1 : yesterdayLog.dayIndex + 1;
    }
    const score = this.SCORE_RULES[dayIndex - 1];

    await this.dataSource.transaction(async (manager) => {
      const log = this.signLogRepository.create({
        userId,
        signDate: today,
        dayIndex,
        score,
      });
      await manager.save(log);

      await manager
        .createQueryBuilder()
        .update(User)
        .set({
          score: () => `score + ${score}`,
          scoreTotal: () => `score_total + ${score}`,
        })
        .where('id = :id', { id: userId })
        .execute();
    });

    return { code: 0, errmsg: `签到成功，获得${score}积分` };
  }
}
