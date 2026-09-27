import { invalid, objectId } from './administration';

export type ChangeRequestInput = { target: string; type: string; proposedCorrection: string; reason: string };
const fields = ['target', 'type', 'proposedCorrection', 'reason'] as const;

function text(value: unknown, field: typeof fields[number], max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) invalid(field, `Enter 1–${max} characters`);
  return value.trim();
}

function requestFields(body: unknown, expectedVersion?: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body');
  const input = body as Record<string, unknown>;
  for (const key of Object.keys(input)) if (![...fields, ...(expectedVersion === undefined ? [] : ['expectedVersion'])].includes(key as never)) invalid(key, 'Field is not permitted');
  const result: ChangeRequestInput = {
    target: text(input.target, 'target', 160),
    type: text(input.type, 'type', 80),
    proposedCorrection: text(input.proposedCorrection, 'proposedCorrection', 500),
    reason: text(input.reason, 'reason', 500),
  };
  if (expectedVersion !== undefined) {
    if (!Number.isSafeInteger(input.expectedVersion) || (input.expectedVersion as number) < 0) invalid('expectedVersion');
    return { ...result, expectedVersion: input.expectedVersion as number };
  }
  return result;
}

export function changeRequestInput(body: unknown) { return requestFields(body); }
export function changeRequestPatch(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body');
  const input = body as Record<string, unknown>;
  if (!Object.hasOwn(input, 'expectedVersion')) invalid('expectedVersion');
  return requestFields(input, input.expectedVersion) as ChangeRequestInput & { expectedVersion: number };
}
export function changeRequestId(value: unknown) { return objectId(value); }