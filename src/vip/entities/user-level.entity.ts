import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_levels')
export class UserLevel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  name: string;

  @Column({ type: 'int' })
  level: number;

  @Column({ name: 'price', type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ length: 500, nullable: true })
  image: string;

  @Column({ name: 'background_image', length: 500, nullable: true })
  backgroundImage: string;

  @Column({ type: 'text', nullable: true, comment: '特权说明 JSON' })
  privilege: string;

  @Column({ name: 'rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  rate: number;

  @Column({ name: 'ship_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  shipRate: number;

  @Column({ name: 'store_days', type: 'int', nullable: true })
  storeDays: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  fee: number;

  @Column({ name: 'over_time_fee', type: 'decimal', precision: 10, scale: 2, nullable: true })
  overTimeFee: number;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
