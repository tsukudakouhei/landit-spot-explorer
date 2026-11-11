import { Controller, Get, Query } from '@nestjs/common';
import { ListCategoriesOutput, ListCategoriesUseCase } from '../../application/list-categories.usecase';
import { ListSpotsOutput, ListSpotsUseCase } from '../../application/list-spots.usecase';
import { SearchSpotsOutput, SearchSpotsUseCase } from '../../application/search-spots.usecase';
import { SearchSpotsQueryDto } from './dto/search-spots.query.dto';

/** HTTP の入出力変換だけを担い、業務ロジックはユースケースに委ねる。 */
@Controller('spots')
export class SpotsController {
  constructor(
    private readonly searchSpots: SearchSpotsUseCase,
    private readonly listSpots: ListSpotsUseCase,
    private readonly listCategories: ListCategoriesUseCase,
  ) {}

  /** 全スポット。地図に全体を表示するために使う。 */
  @Get()
  list(): Promise<ListSpotsOutput> {
    return this.listSpots.execute();
  }

  @Get('search')
  search(@Query() query: SearchSpotsQueryDto): Promise<SearchSpotsOutput> {
    return this.searchSpots.execute(query);
  }

  @Get('categories')
  categories(): Promise<ListCategoriesOutput> {
    return this.listCategories.execute();
  }
}
