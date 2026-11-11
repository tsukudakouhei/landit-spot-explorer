import { NewSpot } from '../../domain/spot/spot.entity';
import { SpotRepository, UpsertResult } from '../../domain/spot/spot.repository';
import { CsvParseError, CsvSeeder, parseSpotsCsv } from './csv-seeder';

describe('parseSpotsCsv', () => {
  it('long 列を lng に読み替え、lat / lng を数値に変換する', () => {
    const rows = parseSpotsCsv('name,category,lat,long,address\n東京タワー,観光名所,35.658581,139.745433,東京都港区');

    expect(rows).toEqual([
      { name: '東京タワー', category: '観光名所', lat: 35.658581, lng: 139.745433, address: '東京都港区', line: 2 },
    ]);
    expect(typeof rows[0].lat).toBe('number');
  });

  it('空行・末尾改行・CRLF・BOM を許容する', () => {
    const csv = '\uFEFFname,category,lat,long,address\r\n\r\nA,公園,35,139,東京都\r\n   \r\nB,神社,36,140,千葉県\r\n';

    expect(parseSpotsCsv(csv).map((row) => [row.name, row.line])).toEqual([
      ['A', 3],
      ['B', 5],
    ]);
  });

  it('列順が違っても列名で読む', () => {
    const rows = parseSpotsCsv('address,long,lat,category,name\n東京都港区,139.7,35.6,観光名所,東京タワー');

    expect(rows[0]).toMatchObject({ name: '東京タワー', lat: 35.6, lng: 139.7 });
  });

  it('ダブルクォートで囲まれた列（カンマ・エスケープ含む）を扱える', () => {
    const rows = parseSpotsCsv('name,category,lat,long,address\n"Cafe ""A"", B",カフェ,35,139,"東京都, 港区"');

    expect(rows[0]).toMatchObject({ name: 'Cafe "A", B', address: '東京都, 港区' });
  });

  it('数値でない座標は行番号付きの CsvParseError', () => {
    expect(() => parseSpotsCsv('name,category,lat,long,address\nA,公園,abc,139,東京都')).toThrow(/line 2: column "lat"/);
    expect(() => parseSpotsCsv('name,category,lat,long,address\nA,公園,35,,東京都')).toThrow(CsvParseError);
  });

  it('必須列が無ければ CsvParseError', () => {
    expect(() => parseSpotsCsv('name,category,lat,lng,address\nA,公園,35,139,東京都')).toThrow(/missing required column "long"/);
  });

  it('列数が足りない行は行番号付きの CsvParseError', () => {
    expect(() => parseSpotsCsv('name,category,lat,long,address\nA,公園,35')).toThrow(/line 2: expected 5 columns but got 3/);
  });

  it('列数が多い行も行番号付きの CsvParseError', () => {
    expect(() => parseSpotsCsv('name,category,lat,long,address\nA,公園,35,139,東京都\nB,神社,36,140,千葉県,余分')).toThrow(
      /line 3: expected 5 columns but got 6/,
    );
  });

  it('引用符が閉じていない行は行番号付きの CsvParseError', () => {
    expect(() => parseSpotsCsv('name,category,lat,long,address\n"A,公園,35,139,東京都')).toThrow(/line 2: unclosed double quote/);
  });

  it('空ファイルは 0 件', () => {
    expect(parseSpotsCsv('')).toEqual([]);
  });
});

describe('CsvSeeder', () => {
  function buildRepository() {
    const upsertByName = jest
      .fn<Promise<UpsertResult>, [readonly NewSpot[]]>()
      .mockImplementation((spots) => Promise.resolve({ inserted: spots.length, updated: 0, unchanged: 0 }));
    const repository: SpotRepository = {
      findWithinRadius: jest.fn(),
      findAll: jest.fn(),
      listCategories: jest.fn(),
      upsertByName,
    };
    return { repository, upsertByName };
  }

  it('ドメイン検証を通した NewSpot を upsert し、件数をログする', async () => {
    const { repository, upsertByName } = buildRepository();
    const log = jest.fn<void, [string]>();

    const report = await new CsvSeeder(repository, log).seedFromText(
      'name,category,lat,long,address\nA,公園,35,139,東京都\nB,神社,36,140,千葉県',
    );

    expect(upsertByName).toHaveBeenCalledWith([
      { name: 'A', category: '公園', address: '東京都', lat: 35, lng: 139 },
      { name: 'B', category: '神社', address: '千葉県', lat: 36, lng: 140 },
    ]);
    expect(report).toEqual({ total: 2, inserted: 2, updated: 0, unchanged: 0 });
    expect(log).toHaveBeenCalledWith('Seeded spots: total=2, inserted=2, updated=0, unchanged=0');
  });

  it('2 回目の投入で内容が同じなら inserted=0 updated=0（リポジトリの結果をそのまま報告）', async () => {
    const { repository, upsertByName } = buildRepository();
    upsertByName.mockResolvedValueOnce({ inserted: 0, updated: 0, unchanged: 2 });
    const log = jest.fn<void, [string]>();

    const report = await new CsvSeeder(repository, log).seedFromText(
      'name,category,lat,long,address\nA,公園,35,139,東京都\nB,神社,36,140,千葉県',
    );

    expect(report).toEqual({ total: 2, inserted: 0, updated: 0, unchanged: 2 });
    expect(log).toHaveBeenCalledWith('Seeded spots: total=2, inserted=0, updated=0, unchanged=2');
  });

  it('CSV 内で name が重複したら後勝ちで 1 件にまとめる', async () => {
    const { repository, upsertByName } = buildRepository();

    await new CsvSeeder(repository, jest.fn()).seedFromText(
      'name,category,lat,long,address\nA,公園,35,139,旧\nA,公園,35,139,新',
    );

    expect(upsertByName.mock.calls[0][0]).toEqual([{ name: 'A', category: '公園', address: '新', lat: 35, lng: 139 }]);
  });

  it('範囲外の座標は行番号付きで失敗し、DB に書き込まない', async () => {
    const { repository, upsertByName } = buildRepository();

    await expect(
      new CsvSeeder(repository, jest.fn()).seedFromText('name,category,lat,long,address\nA,公園,95,139,東京都'),
    ).rejects.toThrow(/line 2: lat out of range/);
    expect(upsertByName).not.toHaveBeenCalled();
  });

  it('同梱の seed/spots.csv は 200 件すべて検証を通る', async () => {
    const { repository } = buildRepository();

    const report = await new CsvSeeder(repository, jest.fn()).seedFromFile(`${__dirname}/../../../seed/spots.csv`);

    expect(report.total).toBe(200);
  });
});
