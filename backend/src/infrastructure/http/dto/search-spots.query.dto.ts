import { IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';
import { ToNumber } from './to-number';

/** クエリ文字列は全て文字列で届くため、数値に変換してから範囲を検証する。 */
export class SearchSpotsQueryDto {
  @ToNumber()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ToNumber()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  /** (0, 50] km。0 は検索の意味がなく、上限は全件スキャン相当の重いクエリを防ぐため。 */
  @ToNumber()
  @IsNumber()
  @IsPositive()
  @Max(50)
  radiusKm!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}
