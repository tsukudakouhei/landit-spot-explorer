import { Logger } from '@nestjs/common';
import { GoogleGeocoder, stripCountryAndPostalCode } from './google-geocoder';
import { FetchFn } from './http-json';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function mockFetch(response: Response) {
  return jest.fn<ReturnType<FetchFn>, Parameters<FetchFn>>().mockResolvedValue(response);
}

describe('GoogleGeocoder', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  it('latlng・language=ja・key を付けて Geocoding API を呼ぶ', async () => {
    const fetchFn = mockFetch(jsonResponse({ status: 'ZERO_RESULTS', results: [] }));

    await new GoogleGeocoder('test-key', fetchFn).reverse(35.681, 139.767);

    const url = new URL(fetchFn.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/geocode/json');
    expect(url.searchParams.get('latlng')).toBe('35.681,139.767');
    expect(url.searchParams.get('language')).toBe('ja');
    expect(url.searchParams.get('key')).toBe('test-key');
  });

  it('results[0].formatted_address から「日本、〒xxx-xxxx 」を取り除く', async () => {
    const fetchFn = mockFetch(
      jsonResponse({
        status: 'OK',
        results: [
          { formatted_address: '日本、〒100-0005 東京都千代田区丸の内１丁目' },
          { formatted_address: '日本、東京都千代田区' },
        ],
      }),
    );

    await expect(new GoogleGeocoder('k', fetchFn).reverse(35.681, 139.767)).resolves.toEqual({
      kind: 'found',
      address: '東京都千代田区丸の内１丁目',
      provider: 'google',
    });
  });

  it('ZERO_RESULTS（海上など）は not_found。失敗ではないのでログを出さない', async () => {
    const fetchFn = mockFetch(jsonResponse({ status: 'ZERO_RESULTS', results: [] }));

    await expect(new GoogleGeocoder('k', fetchFn).reverse(30, 140)).resolves.toEqual({ kind: 'not_found', provider: 'google' });
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(['REQUEST_DENIED', 'OVER_QUERY_LIMIT', 'UNKNOWN_ERROR'])('%s は例外にせずログして unavailable', async (status) => {
    const fetchFn = mockFetch(jsonResponse({ status, error_message: 'The provided API key is invalid.', results: [] }));

    await expect(new GoogleGeocoder('k', fetchFn).reverse(35, 139)).resolves.toEqual({
      kind: 'unavailable',
      provider: 'google',
      reason: `status ${status}: The provided API key is invalid.`,
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(status));
  });

  it('Plus Code だけの結果（海上など）は住所として扱わず not_found', async () => {
    const fetchFn = mockFetch(
      jsonResponse({ status: 'OK', results: [{ formatted_address: '8Q6XGV2X+2X', types: ['plus_code'] }] }),
    );

    const result = await new GoogleGeocoder('test-key', fetchFn).reverse(34.5, 139.9);

    expect(result).toEqual({ kind: 'not_found', provider: 'google' });
  });

  it('先頭が Plus Code でも、後ろに住所の結果があればそれを使う', async () => {
    const fetchFn = mockFetch(
      jsonResponse({
        status: 'OK',
        results: [
          { formatted_address: '8Q7XMQJ8+FR', types: ['plus_code'] },
          { formatted_address: '日本、〒100-0005 東京都千代田区丸の内１丁目', types: ['sublocality'] },
        ],
      }),
    );

    const result = await new GoogleGeocoder('test-key', fetchFn).reverse(35.681, 139.767);

    expect(result).toEqual({ kind: 'found', address: '東京都千代田区丸の内１丁目', provider: 'google' });
  });

  it('HTTP 500 はログして unavailable。ログに API キーを含めない', async () => {
    const fetchFn = mockFetch(jsonResponse({}, 500));

    await expect(new GoogleGeocoder('secret-key', fetchFn).reverse(35, 139)).resolves.toEqual({
      kind: 'unavailable',
      provider: 'google',
      reason: 'HTTP 500',
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('secret-key'));
  });

  it('タイムアウトは unavailable', async () => {
    const fetchFn = jest
      .fn<ReturnType<FetchFn>, Parameters<FetchFn>>()
      .mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));

    await expect(new GoogleGeocoder('k', fetchFn).reverse(35, 139)).resolves.toMatchObject({
      kind: 'unavailable',
      reason: expect.stringContaining('TimeoutError') as unknown,
    });
    expect(warn).toHaveBeenCalled();
  });

  it('ネットワークエラーも unavailable', async () => {
    const fetchFn = jest.fn<ReturnType<FetchFn>, Parameters<FetchFn>>().mockRejectedValue(new TypeError('fetch failed'));

    await expect(new GoogleGeocoder('k', fetchFn).reverse(35, 139)).resolves.toMatchObject({ kind: 'unavailable' });
  });

  it('想定外の JSON 形は unavailable', async () => {
    const fetchFn = mockFetch(jsonResponse(['unexpected']));

    await expect(new GoogleGeocoder('k', fetchFn).reverse(35, 139)).resolves.toMatchObject({ kind: 'unavailable' });
  });
});

describe('stripCountryAndPostalCode', () => {
  it.each([
    ['日本、〒100-0005 東京都千代田区丸の内１丁目', '東京都千代田区丸の内１丁目'],
    ['日本、〒100-0005東京都千代田区', '東京都千代田区'],
    ['日本、東京都千代田区', '東京都千代田区'],
    ['東京都千代田区丸の内１丁目', '東京都千代田区丸の内１丁目'],
  ])('%s → %s', (input, expected) => {
    expect(stripCountryAndPostalCode(input)).toBe(expected);
  });

  it('文中の「日本、」は消さない', () => {
    expect(stripCountryAndPostalCode('東京都中央区日本橋')).toBe('東京都中央区日本橋');
  });
});
