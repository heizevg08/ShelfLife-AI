/*
 * Read-only compatibility report for the existing changeRequests collection.
 *
 * Usage (do not run against production without an approved read-only URI):
 *   MONGO_URI='mongodb+srv://readonly-user:...' npx tsx src/scripts/report-change-request-compatibility.ts
 *
 * The script reports aggregate counts only. It makes no writes and prints no
 * record values or credentials. Legacy documents (without schemaVersion: 2)
 * remain read-only history under the typed workflow.
 */
import { Mongoose } from 'mongoose';

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required');
  const driver = new Mongoose();
  await driver.connect(uri, { autoIndex: false, autoCreate: false });
  try {
    const rows = driver.connection.collection('changeRequests');
    const [total, typed, legacy, status] = await Promise.all([
      rows.countDocuments({}),
      rows.countDocuments({ schemaVersion: 2 }),
      rows.countDocuments({ schemaVersion: { $ne: 2 } }),
      rows.aggregate([{ $group: { _id: { schemaVersion: '$schemaVersion', status: '$status' }, count: { $sum: 1 } } }]).toArray(),
    ]);
    console.info(JSON.stringify({ total, typed, legacy, bySchemaVersionAndStatus: status }, null, 2));
  } finally { await driver.disconnect(); }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Compatibility report failed'); process.exitCode = 1; });
