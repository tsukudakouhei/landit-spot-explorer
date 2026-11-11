import { createNewSpot, InvalidSpotError } from './spot.entity';

const valid = { name: ' 東京駅 ', category: '交通機関', address: '東京都千代田区', lat: 35.681236, lng: 139.767125 };

describe('createNewSpot', () => {
  it('前後の空白を除いた NewSpot を返す', () => {
    expect(createNewSpot(valid)).toEqual({ ...valid, name: '東京駅' });
  });

  it.each([
    ['name が空', { name: '  ' }],
    ['category が空', { category: '' }],
    ['address が空', { address: '' }],
    ['lat が範囲外', { lat: 90.1 }],
    ['lng が範囲外', { lng: -180.1 }],
    ['lat が NaN', { lat: Number.NaN }],
  ])('%s なら InvalidSpotError', (_label, override) => {
    expect(() => createNewSpot({ ...valid, ...override })).toThrow(InvalidSpotError);
  });
});
