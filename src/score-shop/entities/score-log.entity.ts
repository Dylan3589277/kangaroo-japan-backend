import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/user.entity';

@Entity('score_logs')
@Index('idx_score_logs_user', ['userId'])
export class ScoreLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int', comment: '变动数量（正=增加, 负=减少）' })
  amount: number;

  @Column({ length: 30, comment: '变动类型: exchange=兑换, earn=赚取, admin=管理调整' })
  type: string;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string;

  @Column({ name: 'before_score', type: 'int', comment: '变动前积分' })
  beforeScore: number;

  @Column({ name: 'after_score', type: 'int', comment: '变动后积分' })
  afterScore: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
