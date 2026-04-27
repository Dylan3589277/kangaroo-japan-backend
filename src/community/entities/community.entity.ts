import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('community')
@Index('idx_community_status', ['status'])
@Index('idx_community_user', ['userId'])
export class Community {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'title', length: 255, nullable: true })
  title: string;

  @Column({ name: 'content', type: 'text', nullable: true })
  content: string;

  @Column({ name: 'pictures', type: 'text', nullable: true, comment: '逗号分隔的图片URL' })
  pictures: string;

  @Column({ name: 'remark', type: 'text', nullable: true })
  remark: string;

  @Column({ name: 'result', type: 'text', nullable: true })
  result: string;

  @Column({ name: 'status', type: 'int', default: 0, comment: '0=待审核 1=已通过 -1=已取消' })
  status: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
