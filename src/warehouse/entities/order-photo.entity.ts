import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('order_photos')
export class OrderPhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', length: 36, nullable: true })
  orderId: string;

  @Column({ type: 'text', nullable: true })
  uri: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
