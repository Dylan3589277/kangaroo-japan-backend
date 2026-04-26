import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitySubmission } from './activity-submission.entity';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';

@Module({
  imports: [TypeOrmModule.forFeature([ActivitySubmission])],
  controllers: [ActivityController],
  providers: [ActivityService],
})
export class ActivityModule {}
