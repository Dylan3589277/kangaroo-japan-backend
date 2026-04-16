import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

export enum AddressCountry {
  CN = "CN",
  JP = "JP",
  US = "US",
  UK = "UK",
  AU = "AU",
  DE = "DE",
  FR = "FR",
  KR = "KR",
  TW = "TW",
  HK = "HK",
  SG = "SG",
  CA = "CA",
  OTHER = "OTHER",
}

export enum AddressLabel {
  HOME = "home",
  WORK = "work",
  OTHER = "other",
}

@Entity("addresses")
export class Address {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id" })
  userId: string;

  @ManyToOne(() => User, (user) => user.addresses, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "recipient_name", length: 100 })
  recipientName: string;

  @Column({ length: 30 })
  phone: string;

  @Column({ length: 255, nullable: true })
  email: string;

  @Column({
    type: "enum",
    enum: AddressCountry,
    default: AddressCountry.CN,
  })
  country: AddressCountry;

  @Column({ name: "address_line1", length: 255 })
  addressLine1: string;

  @Column({ name: "address_line2", length: 255, nullable: true })
  addressLine2: string;

  @Column({ length: 100, nullable: true })
  state: string;

  @Column({ name: "state_code", length: 20, nullable: true })
  stateCode: string;

  @Column({ length: 100 })
  city: string;

  @Column({ name: "city_code", length: 20, nullable: true })
  cityCode: string;

  @Column({ length: 100, nullable: true })
  district: string;

  @Column({ name: "district_code", length: 20, nullable: true })
  districtCode: string;

  @Column({ name: "postal_code", length: 20, nullable: true })
  postalCode: string;

  @Column({ name: "full_address_text", type: "jsonb", nullable: true })
  fullAddressText: Record<string, string>;

  @Column({
    type: "enum",
    enum: AddressLabel,
    default: AddressLabel.HOME,
  })
  label: AddressLabel;

  @Column({ name: "is_default", default: false })
  isDefault: boolean;

  @Column({
    name: "alternative_recipient_name",
    length: 100,
    nullable: true,
  })
  alternativeRecipientName: string;

  @Column({ name: "alternative_phone", length: 30, nullable: true })
  alternativePhone: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
