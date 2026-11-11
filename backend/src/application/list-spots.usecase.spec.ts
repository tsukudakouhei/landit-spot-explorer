import { Spot } from '../domain/spot/spot.entity';
import { SpotRepository } from '../domain/spot/spot.repository';
import { ListSpotsUseCase } from './list-spots.usecase';

describe('ListSpotsUseCase', () => {
  it('リポジトリの全スポットを items と件数で返す', async () => {
    const spots: Spot[] = [
      { id: '1', name: '東京駅', category: '交通機関', address: '東京都千代田区', lat: 35.681, lng: 139.767 },
      { id: '2', name: '清水寺', category: '寺院', address: '京都府京都市', lat: 34.995, lng: 135.785 },
    ];
    const repository: SpotRepository = {
      findWithinRadius: jest.fn(),
      findAll: jest.fn().mockResolvedValue(spots),
      listCategories: jest.fn(),
      upsertByName: jest.fn(),
    };

    await expect(new ListSpotsUseCase(repository).execute()).resolves.toEqual({ items: spots, total: 2 });
  });
});
