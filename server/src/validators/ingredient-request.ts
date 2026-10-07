import { invalid, objectId } from './administration';
import { expectedVersion } from './inventory-contract';
import { ingredientInput, ingredientPatch, type IngredientInput } from './ingredient';
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
  const patch = ingredientPatch(body);
  return { input: patch.patch as Partial<IngredientInput>, expectedVersion: patch.expectedVersion };
}

export function ingredientRequestId(value: unknown) { return objectId(value); }
export { ingredientInput as ingredientRequestInput };
