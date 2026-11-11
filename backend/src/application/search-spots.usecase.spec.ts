import { SpotWithDistance } from '../domain/spot/spot.entity';
import { SpotRepository, SpotSearchCriteria, UpsertResult } from '../domain/spot/spot.repository';
import { SearchSpotsUseCase } from './search-spots.usecase';

function buildRepository(found: SpotWithDistance[]) {
  const findWithinRadius = jest.fn<Promise<SpotWithDistance[]>, [SpotSearchCriteria]>().mockResolvedValue(found);
  const repository: SpotRepository = {
    findWithinRadius,
    findAll: jest.fn(),
    listCategories: jest.fn<Promise<string[]>, []>(),
    upsertByName: jest.fn<Promise<UpsertResult>, []>(),
  };
  return { repository, findWithinRadius };
}

const tower: SpotWithDistance = {
  id: '11111111-1111-1111-1111-111111111111',
  name: '東京タワー',
  category: '観光名所',
  address: '東京都港区',
  lat: 35.658581,
  lng: 139.745433,
  distanceM: 123.456,
};

describe('SearchSpotsUseCase', () => {
  it('km をメートルに換算し、中心座標とカテゴリをリポジトリへ渡す', async () => {
    const { repository, findWithinRadius } = buildRepository([]);

    await new SearchSpotsUseCase(repository).execute({ lat: 35.68, lng: 139.76, radiusKm: 2.5, category: '公園' });

    expect(findWithinRadius).toHaveBeenCalledWith({
      center: { lat: 35.68, lng: 139.76 },
      radiusM: 2500,
      category: '公園',
    });
  });

  it.each([undefined, '', '   '])('カテゴリ %p は「指定なし」として渡す', async (category) => {
    const { repository, findWithinRadius } = buildRepository([]);

    await new SearchSpotsUseCase(repository).execute({ lat: 35.68, lng: 139.76, radiusKm: 1, category });

    expect(findWithinRadius.mock.calls[0][0].category).toBeUndefined();
  });

  it('契約どおりの形（items, total, center, radiusKm）で返し、距離は小数第1位に丸める', async () => {
    const station: SpotWithDistance = { ...tower, id: '2', name: '東京駅', distanceM: 1500.04 };
    const { repository } = buildRepository([tower, station]);

    const result = await new SearchSpotsUseCase(repository).execute({ lat: 35.68, lng: 139.76, radiusKm: 2 });

    expect(result).toEqual({
      items: [
        { ...tower, distanceM: 123.5 },
        { ...station, distanceM: 1500 },
      ],
      total: 2,
      center: { lat: 35.68, lng: 139.76 },
      radiusKm: 2,
    });
  });

  it('リポジトリの並び順（距離昇順）を崩さない', async () => {
    const near = { ...tower, id: 'a', distanceM: 10 };
    const far = { ...tower, id: 'b', distanceM: 900 };
    const { repository } = buildRepository([near, far]);

    const result = await new SearchSpotsUseCase(repository).execute({ lat: 0, lng: 0, radiusKm: 1 });

    expect(result.items.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('0 件のときは空配列と total 0 を返す', async () => {
    const { repository } = buildRepository([]);

    const result = await new SearchSpotsUseCase(repository).execute({ lat: 35, lng: 139, radiusKm: 0.5 });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});
