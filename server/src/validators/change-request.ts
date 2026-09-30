import { invalid, objectId } from './administration';
import { catalogueText, proseText } from './text';

export type ChangeRequestInput = { target: string; type: string; proposedCorrection: string; reason: string };
const fields = ['target', 'type', 'proposedCorrection', 'reason'] as const;

const changeTypes = ['Quantity correction', 'Expiration date', 'Batch details', 'Ingredient details', 'Other'] as const;

function requestFields(body: unknown, expectedVersion?: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body');
  const input = body as Record<string, unknown>;
  for (const key of Object.keys(input)) if (![...fields, ...(expectedVersion === undefined ? [] : ['expectedVersion'])].includes(key as never)) invalid(key, 'Field is not permitted');
  const result: ChangeRequestInput = {
    target: catalogueText(input.target, 'target', true, 160),
    type: typeof input.type === 'string' && changeTypes.includes(input.type as typeof changeTypes[number]) ? input.type : invalid('type', 'Select a valid change type'),
    proposedCorrection: proseText(input.proposedCorrection, 'proposedCorrection', true, 500),
    reason: proseText(input.reason, 'reason', true, 500),
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
