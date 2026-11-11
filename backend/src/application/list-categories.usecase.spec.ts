import { SpotRepository } from '../domain/spot/spot.repository';
import { ListCategoriesUseCase } from './list-categories.usecase';

describe('ListCategoriesUseCase', () => {
  it('リポジトリのカテゴリ一覧を items で包んで返す', async () => {
    const repository: SpotRepository = {
      findWithinRadius: jest.fn(),
      listCategories: jest.fn().mockResolvedValue(['公園', '神社']),
      upsertByName: jest.fn(),
    };

    await expect(new ListCategoriesUseCase(repository).execute()).resolves.toEqual({ items: ['公園', '神社'] });
  });
});
