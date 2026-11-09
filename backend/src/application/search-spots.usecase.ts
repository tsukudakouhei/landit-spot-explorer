import { Coordinates, SpotWithDistance } from '../domain/spot/spot.entity';
import { SpotRepository } from '../domain/spot/spot.repository';

export interface SearchSpotsInput {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly category?: string;
}

export interface SearchSpotsOutput {
  readonly items: SpotWithDistance[];
  readonly total: number;
  readonly center: Coordinates;
  readonly radiusKm: number;
}

/** 距離はメートルの小数第1位までで十分（UI 表示用）。 */
function roundDistance(distanceM: number): number {
  return Math.round(distanceM * 10) / 10;
}

export class SearchSpotsUseCase {
  constructor(private readonly spots: SpotRepository) {}

  async execute(input: SearchSpotsInput): Promise<SearchSpotsOutput> {
    const center: Coordinates = { lat: input.lat, lng: input.lng };
    // 空文字のカテゴリは「指定なし」とみなす（?category= のようなクエリへの配慮）
    const category = input.category?.trim() || undefined;

    const found = await this.spots.findWithinRadius({
      center,
      radiusM: input.radiusKm * 1000,
      category,
    });

    const items = found.map((spot) => ({ ...spot, distanceM: roundDistance(spot.distanceM) }));
    return { items, total: items.length, center, radiusKm: input.radiusKm };
  }
}
