import { Logger } from '@nestjs/common';
import { loadConfig } from '../config/app-config';
import { GoogleGeocoder } from '../geocoding/google-geocoder';
import { GsiGeocoder } from '../geocoding/gsi-geocoder';
import { createGeocoder } from './geocode.module';

describe('createGeocoder', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  it('GOOGLE_GEOCODING_API_KEY が空なら GsiGeocoder', () => {
    expect(createGeocoder(loadConfig({ GOOGLE_GEOCODING_API_KEY: '' }))).toBeInstanceOf(GsiGeocoder);
  });

  it('GOOGLE_GEOCODING_API_KEY があれば GoogleGeocoder', () => {
    expect(createGeocoder(loadConfig({ GOOGLE_GEOCODING_API_KEY: 'key' }))).toBeInstanceOf(GoogleGeocoder);
  });
});
