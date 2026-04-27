import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('draw_activitys')
export class DrawActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name', length: 128, default: '' })
  name: string;

  @Column({
    name: 'price',
    type: 'int',
    default: 0,
    comment: '每次抽奖消耗积分',
  })
  price: number;

  @Column({ name: 'content', type: 'text', nullable: true })
  content: string;

  @Column({
    name: 'run_type',
    length: 16,
    default: 'year',
    comment: 'year/month/week',
  })
  runType: string;

  @Column({ name: 'rundate', length: 64, default: '', comment: '运行日期配置' })
  rundate: string;

  @Column({ name: 'status', type: 'int', default: 1, comment: '0=关闭 1=开启' })
  status: number;

  @Column({
    name: 'daily_limit',
    type: 'int',
    default: 0,
    comment: '每日抽奖次数限制(0=不限)',
  })
  dailyLimit: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
