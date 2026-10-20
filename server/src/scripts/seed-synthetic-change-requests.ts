import { Mongoose } from 'mongoose';
import { changeRequestModel } from '../models/change-request';
import { changeRequestCounterModel } from '../models/change-request-counter';
import { ingredientModel } from '../models/ingredient';
import { userModel } from '../models/user';
import { auditRecordModel } from '../models/audit-record';

async function main() {
  const driver = new Mongoose();
  await driver.connect(process.env.MONGO_URI!);
  console.log('Connected to MongoDB Atlas');

  const Requests = changeRequestModel(driver);
  const Counters = changeRequestCounterModel(driver);
  const Ingredients = ingredientModel(driver);
  const Users = userModel(driver);
  const Audits = auditRecordModel(driver);

  const staff = await Users.findOne({ role: 'Inventory Staff', email: 'staff@shelflife.com' }).lean().exec();
  const manager = await Users.findOne({ email: 'manager@shelflife.com' }).lean().exec();

  if (!staff || !manager) {
    console.error('Staff or Manager not found');
    await driver.disconnect();
    return;
  }

  const liempo = await Ingredients.findOne({ name: /Pork Belly/i }).lean().exec();
  const onion = await Ingredients.findOne({ name: /Red Onion/i }).lean().exec();
  const garlic = await Ingredients.findOne({ name: /Garlic/i }).lean().exec();
  const bulalo = await Ingredients.findOne({ name: /Beef Shank/i }).lean().exec();

  if (!liempo || !onion || !garlic || !bulalo) {
    console.error('Ingredients not found');
    await driver.disconnect();
    return;
  }

  const now = new Date();
  const dateKey = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;

  // Resume numbering from the stored counter so re-running the seed keeps IDs unique.
  const counterDoc = await Counters.findOne({ dateKey }).lean().exec();
  let seq = counterDoc?.sequence ?? 2;

  const newRequests = [
    {
      requestType: 'MINIMUM_STOCK_CHANGE' as const,
      ingredientId: liempo._id,
      targetField: 'minimumStock' as const,
      reason: 'Increased weekend customer foot traffic for Pork Liempo requires higher safety buffer.',
      currentValue: String(liempo.minimumStock ?? 15),
      requestedValue: '20',
      status: 'PENDING' as const,
      requestedBy: staff._id,
      createdAt: new Date(Date.now() - 3600000 * 3), // 3 hours ago
      updatedAt: new Date(Date.now() - 3600000 * 3),
    },
    {
      requestType: 'STANDARD_UNIT_COST_CHANGE' as const,
      ingredientId: onion._id,
      targetField: 'standardUnitCost' as const,
      reason: 'Supplier delivery invoice price adjustment effective this week.',
      currentValue: String(onion.standardUnitCost ?? 180),
      requestedValue: '195',
      status: 'PENDING' as const,
      requestedBy: staff._id,
      createdAt: new Date(Date.now() - 3600000 * 6), // 6 hours ago
      updatedAt: new Date(Date.now() - 3600000 * 6),
    },
    {
      requestType: 'DEFAULT_SHELF_LIFE_CHANGE' as const,
      ingredientId: garlic._id,
      targetField: 'defaultShelfLifeDays' as const,
      reason: 'Supplier updated storage advisory for current harvest batch.',
      currentValue: String(garlic.defaultShelfLifeDays ?? 30),
      requestedValue: '25',
      status: 'PENDING' as const,
      requestedBy: staff._id,
      createdAt: new Date(Date.now() - 3600000 * 18), // 18 hours ago
      updatedAt: new Date(Date.now() - 3600000 * 18),
    },
    {
      requestType: 'MINIMUM_STOCK_CHANGE' as const,
      ingredientId: bulalo._id,
      targetField: 'minimumStock' as const,
      reason: 'Rainy season menu promotion increased Bulalo soup orders.',
      currentValue: '8',
      requestedValue: '10',
      status: 'APPROVED' as const,
      requestedBy: staff._id,
      reviewedBy: manager._id,
      reviewedAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
      reviewNote: 'Approved as per revised kitchen prep quota.',
      createdAt: new Date(Date.now() - 86400000 * 3),
      updatedAt: new Date(Date.now() - 86400000 * 2),
    },
  ];

  // Clean up any partial insert from earlier run
  await Requests.deleteMany({ requestID: { $regex: /^REQ-.*-00[3-9]/ } });

  for (const item of newRequests) {
    seq++;
    const requestID = `REQ-${dateKey}-${String(seq).padStart(3, '0')}`;
    const doc = await Requests.create({
      ...item,
      requestID,
    });
    console.log(`Created change request: ${requestID} (${item.requestType} - ${item.status})`);

    await Audits.create({
      userId: staff._id.toString(),
      actorName: 'Development InventoryStaff',
      actorRole: 'Inventory Staff',
      action: 'CREATE',
      targetType: 'ChangeRequest',
      targetId: doc._id.toString(),
      targetName: requestID,
      module: 'Change Requests',
      status: 'Success',
      details: `${item.requestType} submitted`,
    });

    if (item.status === 'APPROVED') {
      await Audits.create({
        userId: manager._id.toString(),
        actorName: 'Development Manager',
        actorRole: 'Manager',
        action: 'UPDATE',
        targetType: 'ChangeRequest',
        targetId: doc._id.toString(),
        targetName: requestID,
        module: 'Change Requests',
        status: 'Success',
        details: `Approved and applied ${item.requestType}`,
      });
    }
  }

  // Persist the last used sequence, so the next seed run continues after it.
  await Counters.findOneAndUpdate(
    { dateKey },
    { $set: { sequence: seq } },
    { upsert: true, new: true }
  );

  console.log(`Updated sequence to ${seq} for dateKey ${dateKey}`);

  const counts = {
    total: await Requests.countDocuments(),
    pending: await Requests.countDocuments({ status: 'PENDING' }),
    approved: await Requests.countDocuments({ status: 'APPROVED' }),
    rejected: await Requests.countDocuments({ status: 'REJECTED' }),
  };
  console.log('Final Change Request Counts:', counts);

  await driver.disconnect();
}

main().catch(console.error);
