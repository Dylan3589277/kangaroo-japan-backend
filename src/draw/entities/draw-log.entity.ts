import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { DrawPrizeType } from './draw-prize.entity';

@Entity('draw_logs')
@Index('idx_draw_logs_user', ['userId'])
export class DrawLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'activity_id', nullable: true })
  activityId: string;

  @Column({ name: 'activity_name', length: 128, default: '' })
  activityName: string;

  @Column({ name: 'price', type: 'int', default: 0, comment: '消耗积分' })
  price: number;

  @Column({ name: 'prize', length: 64, default: '0' })
  prize: string;

  @Column({
    name: 'type',
    type: 'enum',
    enum: DrawPrizeType,
    default: DrawPrizeType.NONE,
  })
  type: DrawPrizeType;

  @Column({ name: 'name', length: 128, default: '' })
  name: string;

  @Column({ name: 'cover', type: 'text', nullable: true })
  cover: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
