import { Mongoose } from 'mongoose';
import { readConfig } from '../config/env';
import { ingredientModel } from '../models/ingredient';
import { inventoryBatchModel } from '../models/inventory-batch';

async function main() {
  console.info('Connecting to MongoDB Atlas to seed operational batch states...');
  const config = readConfig(process.env);
  const driver = new Mongoose();
  await driver.connect(config.mongoUri, { dbName: config.mongoDbName });

  try {
    const batches = inventoryBatchModel(driver);
    const ingredients = ingredientModel(driver);

    // 1. Set 3 batches to Expired (< 2026-10-20)
    // Fresh Bangus, Tomato, Kangkong
    const bangus = await ingredients.findOne({ name: /Bangus/i }).lean().exec();
    if (bangus) {
      const b = await batches.findOne({ ingredientId: bangus._id }).sort({ expirationDate: 1 }).exec();
      if (b) {
        b.expirationDate = new Date('2026-10-18T00:00:00.000Z');
        await b.save();
        console.info(`Updated batch ${b.batchID} (Bangus) to EXPIRED (2026-10-18)`);
      }
    }

    const tomato = await ingredients.findOne({ name: /Tomato/i }).lean().exec();
    if (tomato) {
      const b = await batches.findOne({ ingredientId: tomato._id }).sort({ expirationDate: 1 }).exec();
      if (b) {
        b.expirationDate = new Date('2026-10-16T00:00:00.000Z');
        await b.save();
        console.info(`Updated batch ${b.batchID} (Tomato) to EXPIRED (2026-10-16)`);
      }
    }

    const kangkong = await ingredients.findOne({ name: /Kangkong/i }).lean().exec();
    if (kangkong) {
      const b = await batches.findOne({ ingredientId: kangkong._id }).sort({ expirationDate: 1 }).exec();
      if (b) {
        b.expirationDate = new Date('2026-10-14T00:00:00.000Z');
        await b.save();
        console.info(`Updated batch ${b.batchID} (Kangkong) to EXPIRED (2026-10-14)`);
      }
    }

    // 2. Set 4 batches to Near Expiry (within 7 days of 2026-10-20, i.e., 2026-10-21 to 2026-10-27)
    // Pork Liver, Calamansi, Native Red Onion, Frozen Chicken Thigh
    const liver = await ingredients.findOne({ name: /Pork Liver/i }).lean().exec();
    if (liver) {
      const b = await batches.findOne({ ingredientId: liver._id }).sort({ expirationDate: 1 }).exec();
      if (b) {
        b.expirationDate = new Date('2026-10-22T00:00:00.000Z');
        await b.save();
        console.info(`Updated batch ${b.batchID} (Pork Liver) to NEAR EXPIRY (2026-10-22)`);
      }
    }

    const calamansi = await ingredients.findOne({ name: /Calamansi/i }).lean().exec();
    if (calamansi) {
      const b = await batches.findOne({ ingredientId: calamansi._id }).sort({ expirationDate: 1 }).exec();
      if (b) {
        b.expirationDate = new Date('2026-10-23T00:00:00.000Z');
        await b.save();
        console.info(`Updated batch ${b.batchID} (Calamansi) to NEAR EXPIRY (2026-10-23)`);
      }
    }

    const onion = await ingredients.findOne({ name: /Native Red Onion/i }).lean().exec();
    if (onion) {
      const b = await batches.findOne({ ingredientId: onion._id }).sort({ expirationDate: 1 }).exec();
      if (b) {
        b.expirationDate = new Date('2026-10-25T00:00:00.000Z');
        await b.save();
        console.info(`Updated batch ${b.batchID} (Native Red Onion) to NEAR EXPIRY (2026-10-25)`);
      }
    }

    const chicken = await ingredients.findOne({ name: /Chicken Thigh/i }).lean().exec();
    if (chicken) {
      const b = await batches.findOne({ ingredientId: chicken._id }).sort({ expirationDate: 1 }).exec();
      if (b) {
        b.expirationDate = new Date('2026-10-26T00:00:00.000Z');
        await b.save();
        console.info(`Updated batch ${b.batchID} (Chicken Thigh) to NEAR EXPIRY (2026-10-26)`);
      }
    }

    // 3. Establish 3 additional Low Stock ingredients
    // Beef Shank (total 38 -> min 40)
    await ingredients.updateOne({ name: /Beef Shank/i }, { $set: { minimumStock: 40 } }).exec();
    console.info('Set Beef Shank minimumStock to 40 (Low Stock)');

    // Brown Sugar (total 88 -> min 90)
    await ingredients.updateOne({ name: /Brown Sugar/i }, { $set: { minimumStock: 90 } }).exec();
    console.info('Set Brown Sugar minimumStock to 90 (Low Stock)');

    // Garlic (total 30 -> min 35)
    await ingredients.updateOne({ name: /Garlic/i }, { $set: { minimumStock: 35 } }).exec();
    console.info('Set Garlic minimumStock to 35 (Low Stock)');

    console.info('Successfully updated operational batch and ingredient states in Atlas!');
  } finally {
    await driver.disconnect();
  }
}

main().catch(console.error);
