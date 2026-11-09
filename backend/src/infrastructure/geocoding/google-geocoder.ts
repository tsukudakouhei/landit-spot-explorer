import { Logger } from '@nestjs/common';
import { GeocodeResult, Geocoder } from '../../domain/geocode/geocoder';
import { describeError, FetchFn, isRecord, REQUEST_TIMEOUT_MS } from './http-json';

const GOOGLE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

/** language=ja の formatted_address は「日本、〒100-0005 東京都…」の形になるため、国名と郵便番号を落とす。 */
const COUNTRY_AND_POSTAL_PREFIX = /^日本、\s*(?:〒\d{3}-\d{4}\s*)?/;

export function stripCountryAndPostalCode(formattedAddress: string): string {
  return formattedAddress.replace(COUNTRY_AND_POSTAL_PREFIX, '').trim();
}

/** Geocoding API のレスポンス本文を結果に変換する。 */
export function parseGoogleResponse(body: unknown): GeocodeResult {
  if (!isRecord(body) || typeof body.status !== 'string') {
    return { kind: 'unavailable', provider: 'google', reason: 'unexpected response shape' };
  }
  if (body.status === 'ZERO_RESULTS') return { kind: 'not_found', provider: 'google' };
  if (body.status !== 'OK') {
    // REQUEST_DENIED / OVER_QUERY_LIMIT / INVALID_REQUEST / UNKNOWN_ERROR は「住所が無い」ではなく取得失敗
    const detail = typeof body.error_message === 'string' ? `: ${body.error_message}` : '';
    return { kind: 'unavailable', provider: 'google', reason: `status ${body.status}${detail}` };
  }

  const first: unknown = Array.isArray(body.results) ? body.results[0] : undefined;
  if (!isRecord(first) || typeof first.formatted_address !== 'string') {
    return { kind: 'not_found', provider: 'google' };
  }
  const address = stripCountryAndPostalCode(first.formatted_address);
  return address === '' ? { kind: 'not_found', provider: 'google' } : { kind: 'found', address, provider: 'google' };
}

/** Google Geocoding API による逆ジオコーダ。サーバー側だけで使い、キーをブラウザに出さない。 */
export class GoogleGeocoder implements Geocoder {
  readonly provider = 'google';
  private readonly logger = new Logger(GoogleGeocoder.name);

  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: FetchFn = (input, init) => fetch(input, init),
  ) {}

  async reverse(lat: number, lng: number): Promise<GeocodeResult> {
    const result = await this.request(lat, lng);
    if (result.kind === 'unavailable') {
      // URL にはキーが含まれるため、ログには理由だけを出す
      this.logger.warn(`Google reverse geocoding unavailable: ${result.reason}`);
    }
    return result;
  }

  private async request(lat: number, lng: number): Promise<GeocodeResult> {
    const params = new URLSearchParams({ latlng: `${lat},${lng}`, language: 'ja', key: this.apiKey });
    try {
      const response = await this.fetchFn(`${GOOGLE_ENDPOINT}?${params.toString()}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) return { kind: 'unavailable', provider: 'google', reason: `HTTP ${response.status}` };
      return parseGoogleResponse(await response.json());
    } catch (error) {
      return { kind: 'unavailable', provider: 'google', reason: describeError(error) };
    }
  }
}
