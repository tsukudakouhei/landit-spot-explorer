export interface AppConfig {
  readonly databaseUrl: string;
  readonly port: number;
  readonly corsOrigin: string;
  /** 空文字なら未設定扱い（国土地理院にフォールバック）。 */
  readonly googleGeocodingApiKey: string;
  readonly geocodeCacheTtlDays: number;
  readonly geocodeGridDecimals: number;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

const DEFAULTS = {
  databaseUrl: 'postgres://app:app@localhost:5432/spots',
  port: 3001,
  corsOrigin: 'http://localhost:3000',
  geocodeCacheTtlDays: 30,
  geocodeGridDecimals: 3,
} as const;

function readString(env: NodeJS.ProcessEnv, name: string, fallback: string): string {
  const value = env[name]?.trim();
  return value ? value : fallback;
}

/** 未設定・空文字は既定値、数値として不正なら起動時に失敗させる（誤設定のまま動かさない）。 */
function readInteger(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid ${name}: "${raw}" (expected integer ${min}..${max})`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    databaseUrl: readString(env, 'DATABASE_URL', DEFAULTS.databaseUrl),
    port: readInteger(env, 'PORT', DEFAULTS.port, 1, 65535),
    corsOrigin: readString(env, 'CORS_ORIGIN', DEFAULTS.corsOrigin),
    googleGeocodingApiKey: env.GOOGLE_GEOCODING_API_KEY?.trim() ?? '',
    geocodeCacheTtlDays: readInteger(env, 'GEOCODE_CACHE_TTL_DAYS', DEFAULTS.geocodeCacheTtlDays, 0, 3650),
    // フロントの parseGridDecimals と同じ 1〜6。食い違うと同じ地点でもキーがずれ、キャッシュが効かない
    geocodeGridDecimals: readInteger(env, 'GEOCODE_GRID_DECIMALS', DEFAULTS.geocodeGridDecimals, 1, 6),
  };
}
