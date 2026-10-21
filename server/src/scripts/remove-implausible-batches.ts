import { Mongoose } from 'mongoose';
import { readConfig } from '../config/env';
import { createDatabase } from '../config/database';
import { inventoryBatchModel } from '../models/inventory-batch';
import { usageRecordModel } from '../models/usage-record';
import { wasteRecordModel } from '../models/waste-record';

// Removes inventory batches whose dates cannot be real stock.
//
// Stock-In now rejects an expiration date in the past, so a batch like the
// 1768 or 2020 leftovers can only predate that guard. This script deletes
// exactly the batch IDs named on the command line and nothing else.
//
//   node --import tsx src/scripts/remove-implausible-batches.ts SL-17680706-001 SL-20200720-001
//   ... add --apply to actually delete; without it the run only reports.

const APPLY = process.argv.includes('--apply');
const BATCH_IDS = process.argv.slice(2).filter(arg => !arg.startsWith('--'));

async function main() {
  if (BATCH_IDS.length === 0) {
    console.error('Name at least one batch ID to remove.');
    process.exitCode = 1;
    return;
  }
  const config = readConfig(process.env);
  const driver = new Mongoose();
  const database = createDatabase(driver, config.mongoDbName);
  try {
    await database.connect(config.mongoUri);
    if (driver.connection.name !== config.mongoDbName) throw new Error('Connected database does not match configuration.');
    const batches = inventoryBatchModel(driver);
    const usage = usageRecordModel(driver);
    const waste = wasteRecordModel(driver);

    let matched = 0;
    for (const batchID of BATCH_IDS) {
      const batch = await batches.findOne({ batchID }).lean().exec();
      if (!batch) {
        console.info(`${batchID}: not found, nothing to do`);
        continue;
      }
      matched += 1;
      const [usageCount, wasteCount] = await Promise.all([
        usage.countDocuments({ batchId: batch._id }).exec(),
        waste.countDocuments({ batchId: batch._id }).exec(),
      ]);
      console.info(`${batchID}: received ${batch.dateReceived.toISOString().slice(0, 10)}, expires ${batch.expirationDate.toISOString().slice(0, 10)}, quantity ${batch.quantity} ${batch.unit}, usage ${usageCount}, waste ${wasteCount}`);
      if (usageCount > 0 || wasteCount > 0) {
        const used = await usage.find({ batchId: batch._id }).select('dateUsed quantityUsed staffId').lean().exec();
        const wasted = await waste.find({ batchId: batch._id }).select('dateWasted quantityWasted').lean().exec();
        for (const row of used) console.info(`  usage on ${row.dateUsed.toISOString().slice(0, 10)}: ${row.quantityUsed} ${batch.unit}`);
        for (const row of wasted) console.info(`  waste on ${row.dateWasted.toISOString().slice(0, 10)}: ${row.quantityWasted} ${batch.unit}`);
        console.info(`${batchID}: kept, because usage or waste records still point at it`);
        continue;
      }
      if (!APPLY) {
        console.info(`${batchID}: would be deleted (dry run, add --apply)`);
        continue;
      }
      await batches.deleteOne({ _id: batch._id }).exec();
      console.info(`${batchID}: deleted`);
    }
    if (matched === 0) console.info('No matching batches; nothing changed.');
  } finally {
    await database.disconnect();
  }
}

if (require.main === module) {
  void main().catch(error => {
    console.error('Batch removal failed:', (error as Error).message);
    process.exitCode = 1;
  });
}
