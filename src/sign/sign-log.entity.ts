import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('sign_logs')
@Index('idx_sign_logs_user_date', ['userId', 'signDate'])
export class SignLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'sign_date', type: 'date' })
  signDate: Date;

  @Column({ name: 'day_index', type: 'int' })
  dayIndex: number;

  @Column({ name: 'score', type: 'int', default: 0 })
  score: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
