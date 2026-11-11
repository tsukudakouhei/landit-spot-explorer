import { Spot } from '../domain/spot/spot.entity';
import { SpotRepository } from '../domain/spot/spot.repository';

export interface ListSpotsOutput {
  readonly items: Spot[];
  readonly total: number;
}

/**
 * 全スポットを返す。地図を引いたときに「全国のどこにスポットがあるか」を見せるために使う。
 * 件数が少ない（200 件規模）前提で全件を一度に返す。増えた場合は地図の表示範囲で絞る検索に置き換える。
 */
export class ListSpotsUseCase {
  constructor(private readonly spots: SpotRepository) {}

  async execute(): Promise<ListSpotsOutput> {
    const items = await this.spots.findAll();
    return { items, total: items.length };
  }
}
