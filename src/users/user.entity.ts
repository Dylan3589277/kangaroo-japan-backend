import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { Address } from "./address.entity";

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

export enum UserStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  DELETED = "deleted",
}

export enum PreferredLanguage {
  ZH = "zh",
  EN = "en",
  JA = "ja",
}

export enum PreferredCurrency {
  CNY = "CNY",
  USD = "USD",
  JPY = "JPY",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ unique: true, nullable: true })
  phone: string;

  @Column({ name: "password_hash", select: false, nullable: true })
  passwordHash: string;

  @Column({ length: 100, nullable: true })
  name: string;

  @Column({ name: "avatar_url", length: 500, nullable: true })
  avatarUrl: string;

  @Column({ type: "enum", enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: "enum", enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ name: "deposit_balance", type: "decimal", precision: 12, scale: 2, default: 0 })
  depositBalance: number;

  @Column({ name: "email_verified", default: false })
  emailVerified: boolean;

  @Column({ name: "phone_verified", default: false })
  phoneVerified: boolean;

  @Column({
    name: "preferred_language",
    type: "enum",
    enum: PreferredLanguage,
    default: PreferredLanguage.ZH,
  })
  preferredLanguage: PreferredLanguage;

  @Column({
    name: "preferred_currency",
    type: "enum",
    enum: PreferredCurrency,
    default: PreferredCurrency.CNY,
  })
  preferredCurrency: PreferredCurrency;

  @Column({ name: "last_login_at", nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @OneToMany(() => Address, (address) => address.user)
  addresses: Address[];
}
