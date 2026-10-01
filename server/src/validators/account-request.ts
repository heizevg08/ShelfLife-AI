import { AdministrationError } from '../middleware/administration.middleware';
import { accountInput, invalid, objectId } from './administration';
import { expectedVersion } from './inventory-contract';

export function accountRequestInput(body: unknown, requesterRole: string) {
  if (requesterRole !== 'Admin') {
    throw new AdministrationError(403, 'FORBIDDEN', 'This action is not permitted');
  }
  const input = accountInput(body, false);
  if (!input.firstName || !input.lastName || !input.email || !input.role) invalid('body', 'Provide a name, email, and requested role');
  const allowed = ['Inventory Manager', 'Inventory Staff'];
  if (!allowed.includes(input.role)) invalid('role', 'This role cannot be requested from this account');
  const suffix = input.role === 'Inventory Staff' ? 'staff' : 'manager';
  return { firstName: input.firstName, lastName: input.lastName, email: `${input.firstName.toLowerCase().replace(/\s+/g, '')}${suffix}@shelflife.com`, role: input.role as 'Inventory Manager' | 'Inventory Staff' };
}

export function accountRequestReview(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body');
  const input = body as Record<string, unknown>;
  for (const key of Object.keys(input)) if (!['decision', 'expectedVersion', 'note'].includes(key)) invalid(key, 'Field is not permitted');
  if (input.decision !== 'Approved' && input.decision !== 'Rejected') invalid('decision');
  const version = expectedVersion(input.expectedVersion);
  let note = '';
  if (input.note !== undefined) {
    if (typeof input.note !== 'string' || input.note.trim().length > 500) invalid('note', 'Use at most 500 characters');
    note = input.note.trim();
  }
  return { decision: input.decision, expectedVersion: version, note };
}

export function accountRequestId(value: unknown) { return objectId(value); }
