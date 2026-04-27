import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Community } from './entities/community.entity';

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(Community)
    private repo: Repository<Community>,
  ) {}

  /**
   * 晒单列表（分页+搜索）
   */
  async list(page: number, kw?: string) {
    const limit = 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { status: 1 };
    if (kw && kw.length < 10) {
      where.content = Like(`%${kw}%`);
    }

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const list = items.map((item) => ({
      id: item.id,
      pictures: item.pictures ? item.pictures.split(',') : [],
      content: item.content,
      title: item.title,
      remark: item.remark,
      created_at: item.createdAt,
    }));

    return { list, total, totalPages: Math.ceil(total / limit), page };
  }

  /**
   * 提交晒单
   */
  async submit(userId: string, params: { pictures?: string; content?: string; title?: string; remark?: string }) {
    const community = this.repo.create({
      userId,
      pictures: params.pictures || '',
      content: params.content || '',
      title: params.title || '',
      remark: params.remark || '',
      status: 0, // 待审核
    });
    await this.repo.save(community);
    return { code: 0, errmsg: '提交成功' };
  }

  /**
   * 我的晒单
   */
  async mine(userId: string, page: number) {
    const limit = 20;
    const skip = (page - 1) * limit;

    const [items, total] = await this.repo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const list = items.map((item) => ({
      id: item.id,
      pictures: item.pictures ? item.pictures.split(',') : [],
      content: item.content,
      result: item.result,
      status: item.status,
      created_at: item.createdAt,
    }));

    return { list, total };
  }

  /**
   * 取消晒单
   */
  async cancel(userId: string, id: string) {
    const item = await this.repo.findOne({
      where: { id, userId, status: 0 },
    });

    if (!item) {
      throw new NotFoundException('该记录不存在或已处理');
    }

    item.status = -1;
    await this.repo.save(item);

    return { code: 0, errmsg: '操作成功' };
  }
}
