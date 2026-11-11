import { Coordinates, NewSpot, SpotWithDistance } from './spot.entity';

/** DI トークン。domain がフレームワークを知らずに済むよう Symbol で定義する。 */
export const SPOT_REPOSITORY = Symbol('SPOT_REPOSITORY');

export interface SpotSearchCriteria {
  readonly center: Coordinates;
  readonly radiusM: number;
  /** 指定時は完全一致で絞り込む。 */
  readonly category?: string;
}

export interface UpsertResult {
  readonly inserted: number;
  readonly updated: number;
  /** 既存と内容が同じで書き換えなかった件数。 */
  readonly unchanged: number;
}

export interface SpotRepository {
  /** center から radiusM 以内のスポットを距離昇順で返す。 */
  findWithinRadius(criteria: SpotSearchCriteria): Promise<SpotWithDistance[]>;
  /** 登録済みカテゴリを重複なし・昇順で返す。 */
  listCategories(): Promise<string[]>;
  /** name をキーに冪等に登録・更新する。 */
  upsertByName(spots: readonly NewSpot[]): Promise<UpsertResult>;
}
