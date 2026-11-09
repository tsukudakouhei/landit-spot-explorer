import { loadConfig } from './app-config';

describe('loadConfig', () => {
  it('未設定・空文字なら契約の既定値を使う', () => {
    expect(loadConfig({ PORT: '', GOOGLE_GEOCODING_API_KEY: '' })).toEqual({
      databaseUrl: 'postgres://app:app@localhost:5432/spots',
      port: 3001,
      corsOrigin: 'http://localhost:3000',
      googleGeocodingApiKey: '',
      geocodeCacheTtlDays: 30,
      geocodeGridDecimals: 3,
    });
  });

  it('環境変数の値を読む', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://app:app@db:5432/spots',
      PORT: '8080',
      GOOGLE_GEOCODING_API_KEY: ' key ',
      GEOCODE_CACHE_TTL_DAYS: '7',
      GEOCODE_GRID_DECIMALS: '4',
    });

    expect(config).toMatchObject({ databaseUrl: 'postgres://app:app@db:5432/spots', port: 8080, googleGeocodingApiKey: 'key', geocodeCacheTtlDays: 7, geocodeGridDecimals: 4 });
  });

  it.each([['PORT', 'abc'], ['GEOCODE_GRID_DECIMALS', '2.5'], ['GEOCODE_CACHE_TTL_DAYS', '-1']])(
    '%s=%s のような不正値は起動時にエラー',
    (name, value) => {
      expect(() => loadConfig({ [name]: value })).toThrow(new RegExp(`Invalid ${name}`));
    },
  );
});
