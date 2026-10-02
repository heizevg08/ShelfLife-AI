type StaffChangeValueRecord = {
  targetField?: string;
  ingredient?: { unitOfMeasure?: string };
};

export const formatStaffChangeRequestValue = (record: StaffChangeValueRecord, value: string | undefined) => {
  if (value === undefined || value === '') return '—';
  if (record.targetField === 'minimumStock') {
    const unit = record.ingredient?.unitOfMeasure?.trim();
    return unit && !value.trim().endsWith(` ${unit}`) ? `${value} ${unit}` : value;
  }
  if (record.targetField === 'standardUnitCost') {
    const amount = Number(value);
    return Number.isFinite(amount) ? `₱${amount.toFixed(2)}` : '—';
  }
  if (record.targetField === 'defaultShelfLifeDays') return `${value} ${Number(value) === 1 ? 'day' : 'days'}`;
  return value;
};
