import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ActivityStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('activity_submissions')
@Index('idx_activity_user', ['userId'])
export class ActivitySubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'pictures', type: 'text', nullable: true })
  pictures: string;

  @Column({ name: 'remark', type: 'text', nullable: true })
  remark: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ActivityStatus,
    default: ActivityStatus.PENDING,
  })
  status: ActivityStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
