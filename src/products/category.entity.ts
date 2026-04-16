import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from "typeorm";

@Entity("categories")
export class Category {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "name_zh", length: 100 })
  nameZh: string;

  @Column({ name: "name_en", length: 100 })
  nameEn: string;

  @Column({ name: "name_ja", length: 100 })
  nameJa: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ nullable: true })
  parentId: string;
}
