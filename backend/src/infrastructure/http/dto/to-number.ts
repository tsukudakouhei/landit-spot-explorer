import { Transform } from 'class-transformer';

/** 10 進の整数・小数だけを数値として受け付ける（"0x10" "1e1" "Infinity" などを座標として通さない）。 */
const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * クエリ文字列を数値に変換する。Number() に任せると空文字が 0（「?lat=」が赤道扱い）や
 * 16 進・指数表記まで通ってしまうため、形式に合わない値は undefined に倒して後段の @IsNumber で 400 にする。
 */
export function ToNumber(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return DECIMAL_PATTERN.test(trimmed) ? Number(trimmed) : undefined;
  });
}
