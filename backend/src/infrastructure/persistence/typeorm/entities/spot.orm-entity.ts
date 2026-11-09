import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * spots テーブルの ORM マッピング。
 * location（geography 生成列）は DB が lat/lng から自動計算するため、あえてマッピングしない。
 * ORM から書き込めない形にしておくことで、座標の二重管理による不整合を構造的に防ぐ。
 */
@Entity({ name: 'spots' })
export class SpotOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  name!: string;

  @Column({ type: 'text' })
  category!: string;

  @Column({ type: 'text' })
  address!: string;

  @Column({ type: 'double precision' })
  lat!: number;

  @Column({ type: 'double precision' })
  lng!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
