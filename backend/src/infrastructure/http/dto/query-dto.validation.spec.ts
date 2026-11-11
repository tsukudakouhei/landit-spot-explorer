import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { ReverseGeocodeQueryDto } from './reverse-geocode.query.dto';
import { SearchSpotsQueryDto } from './search-spots.query.dto';

// main.ts と同じ設定の ValidationPipe で、HTTP を立てずにクエリ検証の契約を確認する
const pipe = new ValidationPipe({ transform: true, whitelist: true });

function validate(metatype: ArgumentMetadata['metatype'], query: Record<string, string>): Promise<unknown> {
  return pipe.transform(query, { type: 'query', metatype });
}

async function messagesOf(metatype: ArgumentMetadata['metatype'], query: Record<string, string>): Promise<string[]> {
  try {
    await validate(metatype, query);
  } catch (error) {
    if (error instanceof BadRequestException) {
      const body = error.getResponse();
      if (typeof body === 'object' && 'message' in body && Array.isArray(body.message)) {
        return body.message.map(String);
      }
    }
    throw error;
  }
  throw new Error('expected validation to fail');
}

describe('SearchSpotsQueryDto', () => {
  it('文字列のクエリを数値に変換し、未知のパラメータは捨てる', async () => {
    const dto = await validate(SearchSpotsQueryDto, { lat: '35.68', lng: '139.76', radiusKm: '2', category: '公園', foo: 'bar' });

    expect(dto).toBeInstanceOf(SearchSpotsQueryDto);
    expect(dto).toEqual({ lat: 35.68, lng: 139.76, radiusKm: 2, category: '公園' });
  });

  it('負数・前後の空白・整数は 10 進数として受け付ける', async () => {
    await expect(validate(SearchSpotsQueryDto, { lat: '-33.86', lng: ' 151 ', radiusKm: '3' })).resolves.toEqual({
      lat: -33.86,
      lng: 151,
      radiusKm: 3,
    });
  });

  it('境界値 lat=±90, lng=±180, radiusKm=50 は通す', async () => {
    await expect(validate(SearchSpotsQueryDto, { lat: '-90', lng: '180', radiusKm: '50' })).resolves.toBeDefined();
    await expect(validate(SearchSpotsQueryDto, { lat: '90', lng: '-180', radiusKm: '0.1' })).resolves.toBeDefined();
  });

  it.each([
    ['lat が範囲外', { lat: '90.1', lng: '139', radiusKm: '1' }, 'lat'],
    ['lng が範囲外', { lat: '35', lng: '-180.5', radiusKm: '1' }, 'lng'],
    ['radiusKm が 0', { lat: '35', lng: '139', radiusKm: '0' }, 'radiusKm'],
    ['radiusKm が 50 超', { lat: '35', lng: '139', radiusKm: '50.1' }, 'radiusKm'],
    ['数値でない', { lat: 'abc', lng: '139', radiusKm: '1' }, 'lat'],
    ['空文字（0 扱いにしない）', { lat: '', lng: '139', radiusKm: '1' }, 'lat'],
    ['16 進表記', { lat: '0x10', lng: '139', radiusKm: '1' }, 'lat'],
    ['指数表記', { lat: '35', lng: '139', radiusKm: '1e1' }, 'radiusKm'],
    ['Infinity', { lat: '35', lng: 'Infinity', radiusKm: '1' }, 'lng'],
    ['必須の欠落', { lng: '139', radiusKm: '1' }, 'lat'],
  ])('%s は 400（message[] に該当項目）', async (_label, query, field) => {
    const messages = await messagesOf(SearchSpotsQueryDto, query);

    expect(messages.some((message) => message.startsWith(field))).toBe(true);
  });
});

describe('ReverseGeocodeQueryDto', () => {
  it('lat / lng を数値に変換する', async () => {
    await expect(validate(ReverseGeocodeQueryDto, { lat: '35.681', lng: '139.767' })).resolves.toEqual({ lat: 35.681, lng: 139.767 });
  });

  it('範囲外は 400', async () => {
    await expect(messagesOf(ReverseGeocodeQueryDto, { lat: '91', lng: '139' })).resolves.toEqual(
      expect.arrayContaining([expect.stringMatching(/^lat/)]),
    );
  });
});
