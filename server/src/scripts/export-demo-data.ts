import { Mongoose } from 'mongoose';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { readConfig } from '../config/env';
import { createDatabase } from '../config/database';

// Exports the seeded/demo records that already live in MongoDB into flat CSV files,
// so the same data can be inspected, diffed, versioned or imported into a spreadsheet.
// Nothing here generates data: it only reads what the seed scripts wrote.

const COLLECTIONS = [
  'ingredients',
  'inventorybatches',
  'usageRecords',
  'wasteRecords',
  'forecastSnapshots',
  'changeRequests',
  'auditRecords',
  'users',
] as const;

// Secrets and credential material never leave the database, even for a dev export.
const HIDDEN_FIELDS = new Set([
  'passwordHash',
  'resetTokenHash',
  'resetExpiresAt',
  'pendingEmail',
  'emailChangeCodeHash',
  'emailChangeExpiresAt',
  'emailChangeSentAt',
  'emailChangeAttempts',
  'tokenHash',
]);

type Cell = string | number | boolean | null;

function toCell(value: unknown): Cell {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : '';
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value;
  // ObjectId and other objects that expose toString (plain objects keep JSON shape).
  const maybe = value as { toHexString?: () => string; toString?: () => string };
  if (typeof maybe.toHexString === 'function') return maybe.toHexString();
  if (Buffer.isBuffer(value)) return value.toString('hex');
  if (typeof maybe.toString === 'function' && maybe.toString !== Object.prototype.toString) return maybe.toString();
  return JSON.stringify(value);
}

// Spreadsheet applications may execute a leading formula after CSV import.
function csvCell(value: Cell): string {
  const raw = String(value ?? '');
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/u.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function flatten(document: Record<string, unknown>): Record<string, Cell> {
  const row: Record<string, Cell> = {};
  for (const [key, value] of Object.entries(document)) {
    if (HIDDEN_FIELDS.has(key)) continue;
    if (key === '__v') continue;
    row[key] = toCell(value);
  }
  return row;
}

function toCsv(rows: Record<string, Cell>[]): string {
  if (rows.length === 0) return '\uFEFF\r\n';
  // Stable column order: _id first, then every other field alphabetically.
  const keys = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) keys.add(key);
  const columns = [...keys].sort((a, b) => (a === '_id' ? -1 : b === '_id' ? 1 : a.localeCompare(b)));
  const lines = [columns.map(csvCell).join(',')];
  for (const row of rows) lines.push(columns.map(column => csvCell(row[column] ?? '')).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

function outDirFromArgs(argv: string[]): string {
  const flagIndex = argv.findIndex(arg => arg === '--out' || arg.startsWith('--out='));
  if (flagIndex === -1) return resolve(process.cwd(), '..', 'output', 'demo-data');
  const inline = argv[flagIndex].includes('=') ? argv[flagIndex].split('=').slice(1).join('=') : argv[flagIndex + 1];
  return resolve(inline && !inline.startsWith('--') ? inline : join(process.cwd(), '..', 'output', 'demo-data'));
}

async function main() {
  const config = readConfig(process.env);
  const outDir = outDirFromArgs(process.argv.slice(2));
  const driver = new Mongoose();
  const database = createDatabase(driver, config.mongoDbName);
  try {
    await database.connect(config.mongoUri);
    const source = driver.connection.db;
    if (!source) throw new Error('No database handle available after connecting.');
    await mkdir(outDir, { recursive: true });
    console.info(`Exporting from database "${config.mongoDbName}" into ${outDir}`);

    const summary: { collection: string; rows: number; file: string }[] = [];
    const snapshot: Record<string, unknown[]> = {};
    for (const collectionName of COLLECTIONS) {
      const documents = await source.collection(collectionName)
        .find({}, { projection: Object.fromEntries([...HIDDEN_FIELDS].map(field => [field, 0])) })
        .sort({ _id: 1 })
        .toArray();
      snapshot[collectionName] = documents;
      const rows = documents.map(document => flatten(document as Record<string, unknown>));
      const file = join(outDir, `${collectionName}.csv`);
      await writeFile(file, toCsv(rows), 'utf8');
      summary.push({ collection: collectionName, rows: rows.length, file });
      console.info(`${collectionName}: ${rows.length} rows -> ${collectionName}.csv`);
    }
    // One combined JSON file keeps ObjectIds and dates in their real types for a restore.
    await writeFile(join(outDir, 'all-collections.json'), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    console.info('all-collections.json -> every collection in one file');

    const manifest = [
      `database,${csvCell(config.mongoDbName)}`,
      `exportedAt,${csvCell(new Date().toISOString())}`,
      '',
      ['collection', 'rows', 'file'].map(csvCell).join(','),
      ...summary.map(item => [csvCell(item.collection), csvCell(item.rows), csvCell(item.file)].join(',')),
    ].join('\r\n');
    await writeFile(join(outDir, '_manifest.csv'), `\uFEFF${manifest}\r\n`, 'utf8');

    const total = summary.reduce((sum, item) => sum + item.rows, 0);
    console.info(`Export complete: ${total} rows across ${summary.length} CSV files.`);
  } finally {
    await database.disconnect();
  }
}

if (require.main === module) {
  void main().catch(error => {
    console.error('Demo data export failed:', (error as Error).message);
    process.exitCode = 1;
  });
}
