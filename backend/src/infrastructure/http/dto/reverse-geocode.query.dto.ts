import { IsNumber, Max, Min } from 'class-validator';
import { ToNumber } from './to-number';

export class ReverseGeocodeQueryDto {
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
}
