import { SpotRepository } from '../domain/spot/spot.repository';

export interface ListCategoriesOutput {
  readonly items: string[];
}

export class ListCategoriesUseCase {
  constructor(private readonly spots: SpotRepository) {}

  async execute(): Promise<ListCategoriesOutput> {
    return { items: await this.spots.listCategories() };
  }
}
