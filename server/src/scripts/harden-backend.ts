import { Mongoose } from 'mongoose';
import { createDatabase } from '../config/database';
import { readConfig } from '../config/env';
import { ingredientModel } from '../models/ingredient';
import { loginAttemptModel } from '../models/login-attempt';
import { userModel } from '../models/user';
import { auditRecordModel } from '../models/audit-record';
import { migrateManagerRole, provisionHardeningIndexes } from '../services/backend-maintenance';

async function main() {
  const driver = new Mongoose(), database = createDatabase(driver);
  try {
    await database.connect(readConfig(process.env).mongoUri);
    const indexes = await provisionHardeningIndexes(ingredientModel(driver), loginAttemptModel(driver));
    const migratedAccounts = await migrateManagerRole(driver, userModel(driver), auditRecordModel(driver));
    console.info(JSON.stringify({ ...indexes, migratedAccounts }));
  } finally { await database.disconnect(); }
}
void main().catch(() => { console.error('Backend maintenance failed; check database connectivity, index conflicts, duplicate ingredient names, and transaction support. No credentials or records are logged.'); process.exitCode = 1; });
