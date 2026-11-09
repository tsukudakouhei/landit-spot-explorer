import { Controller, Get, Query } from '@nestjs/common';
import { ReverseGeocodeOutput, ReverseGeocodeUseCase } from '../../application/reverse-geocode.usecase';
import { ReverseGeocodeQueryDto } from './dto/reverse-geocode.query.dto';

@Controller('geocode')
export class GeocodeController {
  constructor(private readonly reverseGeocode: ReverseGeocodeUseCase) {}

  @Get('reverse')
  reverse(@Query() query: ReverseGeocodeQueryDto): Promise<ReverseGeocodeOutput> {
    return this.reverseGeocode.execute(query.lat, query.lng);
  }
}
