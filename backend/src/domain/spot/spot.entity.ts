/** 緯度経度。WGS84（EPSG:4326）の度単位。 */
export interface Coordinates {
  readonly lat: number;
  readonly lng: number;
}

/** 永続化済みのスポット。 */
export interface Spot extends Coordinates {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly address: string;
}

/** まだ ID を持たない（これから保存する）スポット。 */
export type NewSpot = Omit<Spot, 'id'>;

/** 検索結果。検索中心からの距離（メートル）を伴う。 */
export interface SpotWithDistance extends Spot {
  readonly distanceM: number;
}

export class InvalidSpotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSpotError';
  }
}

export function isValidLatitude(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

export function isValidLongitude(lng: number): boolean {
  return Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

/**
 * スポットの不変条件を検証して NewSpot を作る。
 * シードなど外部データはここを通すことで、DB に入る値の妥当性をドメインが保証する。
 */
export function createNewSpot(input: {
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
}): NewSpot {
  const name = input.name.trim();
  const category = input.category.trim();
  const address = input.address.trim();

  if (name === '') throw new InvalidSpotError('name must not be empty');
  if (category === '') throw new InvalidSpotError(`category must not be empty (name=${name})`);
  if (address === '') throw new InvalidSpotError(`address must not be empty (name=${name})`);
  if (!isValidLatitude(input.lat)) throw new InvalidSpotError(`lat out of range: ${input.lat} (name=${name})`);
  if (!isValidLongitude(input.lng)) throw new InvalidSpotError(`lng out of range: ${input.lng} (name=${name})`);

  return { name, category, address, lat: input.lat, lng: input.lng };
}
