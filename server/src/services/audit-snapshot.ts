// Explicit allowlists prevent credentials and arbitrary future fields entering the audit API.
const fields: Record<string, readonly string[]> = {
  SystemConfig: ['approachingDays', 'criticalDays', 'lowStockMultiplier', 'version'],
  InventoryBatch: ['id', 'ingredientId', 'batchCode', 'initialQuantity', 'quantity', 'unit', 'unitCost', 'currency', 'dateReceived', 'expirationDate', 'isActive', 'version', 'createdBy', 'createdAt', 'updatedAt'],
  UsageRecord: ['id', 'ingredientId', 'batchId', 'quantity', 'unit', 'unitCostSnapshot', 'totalCostSnapshot', 'recordedBy', 'recordedAt', 'notes', 'correctionOf', 'type', 'isActive', 'version', 'createdAt', 'updatedAt'],
  WasteRecord: ['id', 'ingredientId', 'batchId', 'quantity', 'unit', 'unitCostSnapshot', 'totalCostSnapshot', 'recordedBy', 'recordedAt', 'notes', 'reason', 'correctionOf', 'type', 'isActive', 'version', 'createdAt', 'updatedAt'],
  User: ['id', 'firstName', 'lastName', 'name', 'email', 'role', 'isActive', 'createdAt', 'updatedAt'],
  Ingredient: ['id', 'name', 'brand', 'description', 'category', 'customCategory', 'unitOfMeasure', 'minimumStock', 'standardUnitCost', 'defaultShelfLifeDays', 'version', 'isActive', 'createdBy', 'createdAt', 'updatedAt'],
  ChangeRequest: ['id', 'schemaVersion', 'requestID', 'requestType', 'ingredientId', 'targetField', 'reason', 'currentValue', 'requestedValue', 'ingredientVersion', 'status', 'requestedBy', 'reviewedBy', 'reviewedAt', 'reviewNote', 'version', 'readOnly', 'name', 'brand', 'description', 'category', 'customCategory', 'unitOfMeasure', 'minimumStock', 'standardUnitCost', 'defaultShelfLifeDays', 'firstName', 'lastName', 'email', 'role', 'requestedByRole', 'createdBy', 'accountId', 'isDeleted', 'deletedBy', 'createdAt', 'updatedAt'],
  AccountRequest: ['id', 'firstName', 'lastName', 'email', 'role', 'requestedBy', 'requestedByRole', 'status', 'reviewedBy', 'reviewNote', 'accountId', 'isDeleted', 'deletedBy', 'version', 'createdAt', 'updatedAt'],
  IngredientRequest: ['id', 'name', 'brand', 'description', 'category', 'customCategory', 'unitOfMeasure', 'minimumStock', 'standardUnitCost', 'defaultShelfLifeDays', 'status', 'version', 'createdBy', 'reviewedBy', 'reviewNote', 'ingredientId', 'isDeleted', 'deletedBy', 'createdAt', 'updatedAt'],
};
export type AuditSnapshot = Record<string, unknown> | null;
export function auditSnapshot(targetType: string, value: unknown): AuditSnapshot {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of fields[targetType] ?? []) {
    const item = source[key];
    if (item instanceof Date) result[key] = item.toISOString();
    else if (['string', 'number', 'boolean'].includes(typeof item) || item === null) result[key] = item;
    else if (key === 'createdBy' && item && typeof item === 'object' && 'id' in item && typeof item.id === 'string') result[key] = item.id;
  }
  return result;
}
