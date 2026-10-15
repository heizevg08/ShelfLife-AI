import type { userModel } from '../models/user';
import type { readDevAdmin } from '../config/auth';
import { hashPassword } from './password';

export async function seedAdmin(users: ReturnType<typeof userModel>, input: ReturnType<typeof readDevAdmin>) {
  if (await users.exists({ email: input.email })) return 'unchanged';
  // An explicit seed-only index ensures concurrent seed commands cannot duplicate an email.
  await users.createIndexes();
  try {
    await users.create({ email: input.email, firstName: input.firstName, lastName: input.lastName,
      passwordHash: await hashPassword(input.password), role: 'Super Admin', isActive: true });
    return 'created';
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) return 'unchanged';
    throw error;
  }
}
