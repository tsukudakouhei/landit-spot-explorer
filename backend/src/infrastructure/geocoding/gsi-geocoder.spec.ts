import { Logger } from '@nestjs/common';
import { FetchFn } from './http-json';
import { formatGsiResponse, GsiGeocoder } from './gsi-geocoder';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('GsiGeocoder', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  it('lat / lon をクエリに付けて国土地理院 API を呼ぶ', async () => {
    const fetchFn = jest.fn<ReturnType<FetchFn>, Parameters<FetchFn>>()
      .mockResolvedValue(jsonResponse({ results: { muniCd: '13101', lv01Nm: '丸の内一丁目' } }));

    await new GsiGeocoder(fetchFn).reverse(35.681, 139.767);

    const url = new URL(fetchFn.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe('https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress');
    expect(url.searchParams.get('lat')).toBe('35.681');
    expect(url.searchParams.get('lon')).toBe('139.767');
  });

  it('muniCd を都道府県＋市区町村に変換し、町字名を連結する', async () => {
    const fetchFn = jest.fn<ReturnType<FetchFn>, Parameters<FetchFn>>()
      .mockResolvedValue(jsonResponse({ results: { muniCd: '13101', lv01Nm: '丸の内一丁目' } }));

    await expect(new GsiGeocoder(fetchFn).reverse(35.681, 139.767)).resolves.toEqual({
      kind: 'found',
      address: '東京都千代田区丸の内一丁目',
      provider: 'gsi',
    });
  });

  it('海上・国外で返る {} は not_found（失敗ではないのでログを出さない）', async () => {
    const fetchFn = jest.fn<ReturnType<FetchFn>, Parameters<FetchFn>>().mockResolvedValue(jsonResponse({}));

    await expect(new GsiGeocoder(fetchFn).reverse(30, 140)).resolves.toEqual({ kind: 'not_found', provider: 'gsi' });
    expect(warn).not.toHaveBeenCalled();
  });

  it('HTTP エラーは例外にせず unavailable（ログを出す）', async () => {
    const fetchFn = jest.fn<ReturnType<FetchFn>, Parameters<FetchFn>>().mockResolvedValue(jsonResponse({}, 503));

    await expect(new GsiGeocoder(fetchFn).reverse(35, 139)).resolves.toEqual({
      kind: 'unavailable',
      provider: 'gsi',
      reason: 'HTTP 503',
    });
    expect(warn).toHaveBeenCalled();
  });

  it('タイムアウトは unavailable', async () => {
    const fetchFn = jest
      .fn<ReturnType<FetchFn>, Parameters<FetchFn>>()
      .mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));

    await expect(new GsiGeocoder(fetchFn).reverse(35, 139)).resolves.toMatchObject({ kind: 'unavailable', provider: 'gsi' });
    expect(warn).toHaveBeenCalled();
  });
});

describe('formatGsiResponse', () => {
  it.each([
    ['対応表にある区', { muniCd: '13113', lv01Nm: '道玄坂二丁目' }, '東京都渋谷区道玄坂二丁目'],
    ['政令市の区', { muniCd: '14104', lv01Nm: '山下町' }, '神奈川県横浜市中区山下町'],
    ['先頭ゼロが落ちたコードも 5 桁に揃える', { muniCd: '13101 ', lv01Nm: '' }, '東京都千代田区'],
    ['町字名が「－」なら市区町村まで', { muniCd: '13101', lv01Nm: '－' }, '東京都千代田区'],
    ['対応表にないコードは町字名のみ', { muniCd: '47201', lv01Nm: '久茂地一丁目' }, '久茂地一丁目'],
  ])('%s', (_label, results, expected) => {
    expect(formatGsiResponse({ results })).toBe(expected);
  });

  it.each([
    ['results が無い（海上など）', {}],
    ['results が null', { results: null }],
    ['不明コードかつ町字名なし', { results: { muniCd: '99999', lv01Nm: '' } }],
    ['想定外の形', 'not json object'],
  ])('%s なら null', (_label, body) => {
    expect(formatGsiResponse(body)).toBeNull();
  });
});
