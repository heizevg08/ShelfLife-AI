import { formatIngredientCurrency, formatIngredientQuantity, formatIngredientShelfLife, INGREDIENT_UNAVAILABLE } from './ingredient-numeric-rules';

type StaffChangeValueRecord = {
  targetField?: string;
  ingredient?: { unitOfMeasure?: string };
};

export const formatStaffChangeRequestValue = (record: StaffChangeValueRecord, value: string | undefined) => {
  if (value === undefined || value === '') return INGREDIENT_UNAVAILABLE;
  if (record.targetField === 'minimumStock') return formatIngredientQuantity(value, record.ingredient?.unitOfMeasure);
  if (record.targetField === 'standardUnitCost') return formatIngredientCurrency(value);
  if (record.targetField === 'defaultShelfLifeDays') return formatIngredientShelfLife(value);
  return value;
};

// One place formats a change-request value. The parts variant exposes the two
// strings separately so a caller can drop a redundant type prefix while showing
// exactly the same text; the composed variant keeps the single-string form.
export const formatChangeRequestComparisonParts = (record: StaffChangeValueRecord & { currentValue?: string; requestedValue?: string }) => ({
  current: formatStaffChangeRequestValue(record, record.currentValue),
  requested: formatStaffChangeRequestValue(record, record.requestedValue),
});

// The composed form keeps the single-string comparison for callers that want it.
// A record with no value on either side shows a dash rather than "— → —".
export const changeRequestComparison = (record: StaffChangeValueRecord & { currentValue?: string; requestedValue?: string }) => {
  const { current, requested } = formatChangeRequestComparisonParts(record);
  return current === '—' && requested === '—' ? '—' : `${current} → ${requested}`;
};
