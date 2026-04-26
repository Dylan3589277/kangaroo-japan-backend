import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('user_providers')
@Index(['provider', 'providerUserId'], { unique: true })
@Index(['userId'])
export class UserProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ default: 'wechat' })
  provider: string;

  @Column({ name: 'provider_user_id' })
  providerUserId: string;

  @Column({ nullable: true })
  unionid: string;

  @Column({ nullable: true })
  type: string;

  @Column({ nullable: true })
  name: string;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @Column({ name: 'session_code', nullable: true })
  sessionCode: string;

  @Column({ name: 'session_key_encrypted', nullable: true })
  sessionKeyEncrypted: string;

  @Column({ name: 'raw_metadata', type: 'jsonb', nullable: true })
  rawMetadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
