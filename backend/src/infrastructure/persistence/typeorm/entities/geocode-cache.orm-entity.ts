import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'geocode_cache' })
export class GeocodeCacheOrmEntity {
  @PrimaryColumn({ name: 'grid_key', type: 'text' })
  gridKey!: string;

  @Column({ type: 'double precision' })
  lat!: number;

  @Column({ type: 'double precision' })
  lng!: number;

  @Column({ name: 'formatted_address', type: 'text', nullable: true })
  formattedAddress!: string | null;

  @Column({ type: 'text' })
  provider!: string;

  @Column({ name: 'fetched_at', type: 'timestamptz', default: () => 'now()' })
  fetchedAt!: Date;
}
