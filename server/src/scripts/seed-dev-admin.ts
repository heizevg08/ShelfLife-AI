import { Mongoose } from 'mongoose';
import { readConfig } from '../config/env';
import { readDevAdmin } from '../config/auth';
import { createDatabase } from '../config/database';
import { userModel } from '../models/user';
import { seedAdmin } from '../services/seed-admin';

async function main() {
  const config = readConfig(process.env);
  const input = readDevAdmin(process.env);
  const driver = new Mongoose();
  const database = createDatabase(driver);
  try {
    await database.connect(config.mongoUri);
    if (driver.connection.name !== 'shelflifeai') throw new Error();
    const result = await seedAdmin(userModel(driver), input);
    console.info(result === 'created' ? 'Development administrator created' : 'Existing account unchanged');
  } finally { await database.disconnect(); }
}
if (require.main === module) void main().catch(() => { console.error('Development administrator seed failed; check local configuration and database availability'); process.exitCode = 1; });
