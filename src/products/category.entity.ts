import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";

@Entity("categories")
@Index("idx_categories_parent", ["parentId"])
@Index("idx_categories_slug", ["slug"])
export class Category {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ nullable: true, name: "parent_id" })
  parentId: string;

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: "parent_id" })
  parent: Category;

  @Column({ type: "int", default: 0 })
  level: number;

  @Column({ type: "int", default: 0, name: "sort_order" })
  sortOrder: number;

  // 多语言名称
  @Column({ length: 100, name: "name_zh" })
  nameZh: string;

  @Column({ length: 100, name: "name_en" })
  nameEn: string;

  @Column({ length: 100, name: "name_ja" })
  nameJa: string;

  @Column({ length: 100, nullable: true, name: "name_ko" })
  nameKo: string;

  @Column({ length: 100, nullable: true, name: "name_th" })
  nameTh: string;

  @Column({ length: 100, nullable: true, name: "name_id" })
  nameId: string;

  @Column({ length: 100, nullable: true, name: "name_vi" })
  nameVi: string;

  @Column({ nullable: true, name: "icon_url" })
  iconUrl: string;

  // 父级路径
  @Column({ type: "uuid", array: true, nullable: true })
  path: string[];

  @Column({ default: true, name: "is_active" })
  isActive: boolean;

  @Column({ nullable: true })
  slug: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
