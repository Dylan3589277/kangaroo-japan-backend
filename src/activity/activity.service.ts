import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivitySubmission } from './activity-submission.entity';

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(ActivitySubmission)
    private repo: Repository<ActivitySubmission>,
  ) {}

  async submit(userId: string, pictures: string, remark: string) {
    const submission = this.repo.create({ userId, pictures, remark });
    await this.repo.save(submission);
    return { code: 0, errmsg: '提交成功，请等待客服进行处理' };
  }
}
