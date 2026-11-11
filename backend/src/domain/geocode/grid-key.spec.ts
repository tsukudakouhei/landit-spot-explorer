import { roundCoordinate, toGridKey } from './grid-key';

describe('toGridKey', () => {
  it('小数第3位に丸めて "<lat>:<lng>" を作る', () => {
    expect(toGridKey(35.681236, 139.767125, 3)).toBe('35.681:139.767');
  });

  it('四捨五入する（切り捨てではない）', () => {
    expect(toGridKey(35.6816, 139.7675, 3)).toBe('35.682:139.768');
  });

  it('桁数を固定し末尾の 0 を落とさない', () => {
    expect(toGridKey(35.68, 139.7, 3)).toBe('35.680:139.700');
    expect(toGridKey(35, 139, 2)).toBe('35.00:139.00');
  });

  it('decimals に応じて桁数が変わる', () => {
    expect(toGridKey(35.681236, 139.767125, 0)).toBe('36:140');
    expect(toGridKey(35.681236, 139.767125, 1)).toBe('35.7:139.8');
    expect(toGridKey(35.681236, 139.767125, 5)).toBe('35.68124:139.76713');
  });

  it('負の座標（南半球・西半球）も扱える', () => {
    expect(toGridKey(-33.868820, -151.209296, 3)).toBe('-33.869:-151.209');
  });

  it('負の .5 は正の場合と対称に丸める', () => {
    expect(roundCoordinate(-1.5, 0)).toBe(-2);
    expect(roundCoordinate(1.5, 0)).toBe(2);
    expect(toGridKey(-0.5, 0.5, 0)).toBe('-1:1');
  });

  it('0 付近の負数で "-0.000" を作らない', () => {
    expect(toGridKey(-0.0001, -0.0004, 3)).toBe('0.000:0.000');
  });

  it('不正な decimals や座標は RangeError', () => {
    expect(() => toGridKey(35, 139, -1)).toThrow(RangeError);
    expect(() => toGridKey(35, 139, 1.5)).toThrow(RangeError);
    expect(() => toGridKey(35, 139, 11)).toThrow(RangeError);
    expect(() => toGridKey(Number.NaN, 139, 3)).toThrow(RangeError);
  });
});
