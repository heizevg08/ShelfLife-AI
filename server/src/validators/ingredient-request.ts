import { expectedVersion } from './inventory-contract';
import { invalid, objectId } from './administration';
import { ingredientInput } from './ingredient';
import { proseText } from './text';

export function ingredientRequestReview(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body');
  const input = body as Record<string, unknown>;
  for (const key of Object.keys(input)) if (!['decision', 'expectedVersion', 'note'].includes(key)) invalid(key, 'Field is not permitted');
  if (input.decision !== 'Approved' && input.decision !== 'Rejected') invalid('decision');
  let note = '';
  if (input.note !== undefined) {
    note = proseText(input.note, 'note', false, 500);
  }
  return { decision: input.decision, expectedVersion: expectedVersion(input.expectedVersion), note } as const;
}
export type IngredientRequestReview = ReturnType<typeof ingredientRequestReview>;

export function ingredientRequestPatch(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body');
  const input = body as Record<string, unknown>;
  const version = expectedVersion(input.expectedVersion);
  const { expectedVersion: _expectedVersion, ...fields } = input;
  const validated = ingredientInput(fields);
  if (fields.category !== undefined && fields.category !== 'Other' && fields.customCategory === undefined) validated.customCategory = '';
  return { input: validated, expectedVersion: version };
}

export function ingredientRequestId(value: unknown) { return objectId(value); }
export { ingredientInput as ingredientRequestInput };
