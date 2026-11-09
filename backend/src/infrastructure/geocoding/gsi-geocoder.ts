import { Logger } from '@nestjs/common';
import { GeocodeResult, Geocoder } from '../../domain/geocode/geocoder';
import { describeError, FetchFn, isRecord, REQUEST_TIMEOUT_MS } from './http-json';
import { lookupMunicipality } from './gsi-muni';

const GSI_ENDPOINT = 'https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress';

/** 町字名が無いとき API は「－」等を返すことがあるため、空扱いにする。 */
function normalizeLv01Nm(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed === '-' || trimmed === '－' ? '' : trimmed;
}

/**
 * GSI のレスポンス `{ results: { muniCd, lv01Nm } }` を住所文字列に整形する。
 * 対応表にあるコードは「都道府県＋市区町村＋町字」、無いコードは町字のみ（契約どおり）。
 * 海上・国外などで results が無い場合は null。
 */
export function formatGsiResponse(body: unknown): string | null {
  if (!isRecord(body) || !isRecord(body.results)) return null;
  const { muniCd } = body.results;
  const lv01Nm = normalizeLv01Nm(body.results.lv01Nm);
  const municipality = typeof muniCd === 'string' ? lookupMunicipality(muniCd) : undefined;

  if (municipality) return `${municipality}${lv01Nm}`;
  return lv01Nm === '' ? null : lv01Nm;
}

/** 国土地理院の逆ジオコーダ。API キー不要のフォールバック実装。 */
export class GsiGeocoder implements Geocoder {
  readonly provider = 'gsi';
  private readonly logger = new Logger(GsiGeocoder.name);

  constructor(private readonly fetchFn: FetchFn = (input, init) => fetch(input, init)) {}

  async reverse(lat: number, lng: number): Promise<GeocodeResult> {
    const result = await this.request(lat, lng);
    if (result.kind === 'unavailable') {
      this.logger.warn(`GSI reverse geocoding unavailable: ${result.reason}`);
    }
    return result;
  }

  private async request(lat: number, lng: number): Promise<GeocodeResult> {
    const url = `${GSI_ENDPOINT}?${new URLSearchParams({ lat: String(lat), lon: String(lng) }).toString()}`;
    try {
      const response = await this.fetchFn(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) return { kind: 'unavailable', provider: 'gsi', reason: `HTTP ${response.status}` };
      const address = formatGsiResponse(await response.json());
      // GSI は海上・国外で {} を返す。これは失敗ではなく「住所が無い」
      return address === null ? { kind: 'not_found', provider: 'gsi' } : { kind: 'found', address, provider: 'gsi' };
    } catch (error) {
      return { kind: 'unavailable', provider: 'gsi', reason: describeError(error) };
    }
  }
}
